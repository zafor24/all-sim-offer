const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data.json");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD before starting. Example: ADMIN_PASSWORD='use-a-long-unique-password' npm start");
  process.exit(1);
}
const sessions = new Map();

const initial = {
  offers: [
    {id:"gp50", operator:"GP", name:"৫০ জিবি", price:475, validity:"৩০ দিন", active:true},
    {id:"gp50m", operator:"GP", name:"৫০ জিবি + ৫০০ মিনিট", price:550, validity:"৩০ দিন", active:true},
    {id:"robi50", operator:"Robi", name:"৫০ জিবি", price:475, validity:"৩০ দিন", active:true},
    {id:"air50m", operator:"Airtel", name:"৫০ জিবি + ৫০০ মিনিট", price:550, validity:"৩০ দিন", active:true}
  ],
  payments: {bkash:"", nagad:"", rocket:"", upay:""},
  orders: []
};
function load() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); }
  catch { fs.writeFileSync(DATA, JSON.stringify(initial,null,2)); return structuredClone(initial); }
}
let db = load();
function save(){ fs.writeFileSync(DATA, JSON.stringify(db,null,2)); }
function hash(s){ return crypto.createHash("sha256").update(s).digest("hex"); }
function send(res, code, obj, headers={}) {
  res.writeHead(code, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...headers});
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let b=""; req.on("data",c=>{b+=c;if(b.length>1e6) reject(new Error("Too large"));});
    req.on("end",()=>{try{resolve(JSON.parse(b||"{}"));}catch{reject(new Error("Invalid JSON"));}});
  });
}
function token(req){ return (req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("aso_session="))?.slice(12); }
function isAdmin(req){ const t=token(req); return !!t && sessions.has(t); }
function safeOrder(o){ const {id,customer,phone,operator,offerName,payment,status,created}=o; return {id,customer,phone,operator,offerName,payment,status,created}; }

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost");
  if(req.method==="GET" && url.pathname==="/api/offers") return send(res,200,db.offers.filter(o=>o.active));
  if(req.method==="GET" && url.pathname==="/api/payments") return send(res,200,db.payments);
  if(req.method==="POST" && url.pathname==="/api/orders"){
    try{
      const d=await readBody(req);
      const offer=db.offers.find(o=>o.id===d.offerId && o.active);
      if(!offer) return send(res,400,{error:"Offer unavailable"});
      if(!/^(01)[0-9]{9}$/.test(String(d.phone||""))) return send(res,400,{error:"Valid Bangladesh mobile number required"});
      if(!["bKash","Nagad","Rocket","Upay","Cash / Manual"].includes(d.payment)) return send(res,400,{error:"Invalid payment method"});
      const order={id:crypto.randomUUID(),customer:String(d.customer||"").slice(0,80),phone:d.phone,operator:offer.operator,offerName:offer.name,offerId:offer.id,price:offer.price,payment:d.payment,trx:String(d.trx||"").slice(0,100),status:"Pending",created:new Date().toISOString()};
      db.orders.unshift(order); save(); return send(res,201,{orderId:order.id,status:order.status});
    }catch(e){return send(res,400,{error:e.message});}
  }
  if(req.method==="POST" && url.pathname==="/api/my-orders"){
    try{const d=await readBody(req);const list=db.orders.filter(o=>o.phone===d.phone).map(safeOrder);return send(res,200,list);}
    catch(e){return send(res,400,{error:e.message});}
  }
  if(req.method==="POST" && url.pathname==="/api/admin/login"){
    try{
      const d=await readBody(req);
      if(d.username!==ADMIN_USER || hash(String(d.password||""))!==hash(ADMIN_PASSWORD)) return send(res,401,{error:"Invalid login"});
      const t=crypto.randomBytes(32).toString("hex"); sessions.set(t,true);
      return send(res,200,{ok:true},{ "Set-Cookie":`aso_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
    }catch(e){return send(res,400,{error:e.message});}
  }
  if(url.pathname.startsWith("/api/admin/")){
    if(!isAdmin(req)) return send(res,401,{error:"Admin login required"});
    if(req.method==="POST" && url.pathname==="/api/admin/logout"){sessions.delete(token(req));return send(res,200,{ok:true},{ "Set-Cookie":"aso_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});}
    if(req.method==="GET" && url.pathname==="/api/admin/orders") return send(res,200,db.orders);
    if(req.method==="POST" && url.pathname==="/api/admin/offers"){
      try{const d=await readBody(req);const o={id:d.id||crypto.randomUUID(),operator:String(d.operator),name:String(d.name),price:Number(d.price),validity:String(d.validity||""),active:d.active!==false};if(!["GP","Robi","Airtel","Banglalink"].includes(o.operator)||!o.name||!Number.isFinite(o.price)||o.price<0)return send(res,400,{error:"Invalid offer"});const i=db.offers.findIndex(x=>x.id===o.id);if(i>=0)db.offers[i]=o;else db.offers.push(o);save();return send(res,200,o);}
      catch(e){return send(res,400,{error:e.message});}
    }
    if(req.method==="DELETE" && url.pathname.startsWith("/api/admin/offers/")){const id=decodeURIComponent(url.pathname.split("/").pop());db.offers=db.offers.filter(o=>o.id!==id);save();return send(res,200,{ok:true});}
    if(req.method==="POST" && url.pathname==="/api/admin/payments"){try{const d=await readBody(req);for(const k of ["bkash","nagad","rocket","upay"])db.payments[k]=String(d[k]||"").slice(0,30);save();return send(res,200,{ok:true});}catch(e){return send(res,400,{error:e.message});}}
    if(req.method==="POST" && url.pathname==="/api/admin/order-status"){try{const d=await readBody(req);const o=db.orders.find(x=>x.id===d.id);if(!o)return send(res,404,{error:"Order not found"});if(!["Pending","Processing","Completed","Rejected"].includes(d.status))return send(res,400,{error:"Invalid status"});o.status=d.status;save();return send(res,200,{ok:true});}catch(e){return send(res,400,{error:e.message});}}
  }
  let p=url.pathname==="/" ? "/index.html" : url.pathname;
  const file=path.join(__dirname,"public",path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if(!file.startsWith(path.join(__dirname,"public"))) return send(res,403,{error:"Forbidden"});
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end("Not found");}
    const ext=path.extname(file);const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".svg":"image/svg+xml"};
    res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});res.end(data);
  });
});
server.listen(PORT,()=>console.log(`All Sim Offer running on http://localhost:${PORT}`));
