# All Sim Offer — Full-stack starter

This is a server-backed starter for a customer PWA and admin dashboard.

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` values into your hosting environment (do not commit secrets).
3. Set `ADMIN_PASSWORD` to a long unique password. `ADMIN_USER` defaults to `admin`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

No third-party npm packages are required. `data.json` is created automatically and stores offers, orders, and payment numbers on the server.

## Included
- Customer offer catalogue for GP, Robi, Airtel, Banglalink
- Customer order submission and phone-based order lookup
- Admin login using server environment variables
- Admin offer create/edit/delete
- Admin order status management
- bKash, Nagad, Rocket, Upay payment number settings
- PWA manifest and service worker (installable from a supported browser)

## Important: not yet production-ready
- `data.json` is a simple starter datastore, not a production database. Use PostgreSQL/MySQL with backups and migrations for real business.
- Add HTTPS, secure deployment, rate limiting, CSRF protections, audit logs, monitoring, and privacy/terms pages before launch.
- Payment numbers only display instructions; no payment is collected or verified automatically. Use an approved payment gateway and verify transactions server-side.
- Automatic SIM activation/recharge is not implemented. You need authorized operator/aggregator API access and their integration documentation.
- Android APK has not been built. This PWA can be installed from Chrome; a signed APK requires an Android wrapper/build and signing key.
- Never use a shared/default password. The requested `admin/admin` credentials are not used in this server version. Configure a private strong password through `ADMIN_PASSWORD`.

## Suggested production deployment
Deploy on a Node.js host with persistent disk or migrate storage to a managed database. Point your domain to the host and enable HTTPS. Configure environment secrets in the host dashboard, not in source files.
