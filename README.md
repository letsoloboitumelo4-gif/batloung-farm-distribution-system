# Batloung Farm Distribution System

A React/Vite dashboard with a Node.js/Express REST API and a MySQL database for suppliers, fruit pricing, vendors, purchases, sales, stock, payments, and reports.

## Requirements

- Node.js and npm
- MySQL 8.0 or later

## Database setup

1. Start MySQL.
2. From a MySQL client, run [Backend/database/schema.sql](Backend/database/schema.sql). It creates the `batloung_farm` database and its eight tables if they do not already exist.
3. Copy `Backend/.env.example` to `Backend/.env` and set your MySQL host, username, password, database, and port. Never commit `.env`.
4. From the Backend folder, install dependencies with `npm install`.
5. For a new empty database, optionally run `npm run seed` to load sample data. The seed script refuses to run if any application table already contains records.
6. Run `npm run migrate:integrity` to apply the guarded UNIQUE and CHECK constraints to an existing database; run `npm run test:integrity` to verify those constraints using a rolled-back test transaction.
7. Start the API with `npm run dev`. It listens on port 5000 by default. Check the connection at `http://localhost:5000/api/db-test`.

## Frontend setup

From the project root, install packages with `npm install`, then start Vite with `npm run dev`. The Vite development server proxies `/api` requests to `http://localhost:5000`.

The frontend is available at `http://localhost:5173` by default. Keep the backend and MySQL running while using the dashboard.

## Main API routes

- `/api/suppliers` — supplier CRUD
- `/api/fruits` — fruit catalogue, size prices, and status
- `/api/vendors` — vendor registration, search, update, and delete
- `/api/purchases` and `/api/purchase-details` — purchases and line items
- `/api/sales` and `/api/sales-details` — sales, line items, and payment recording
- `/api/stock` — current package-size quantities and low-stock list
- `/api/reports` — revenue, top-selling fruit/vendor, stock, and outstanding balances

Purchases and sales update package-size stock within database transactions. Referenced suppliers, vendors, and fruits cannot be physically deleted when this would break purchase, sale, or stock history. Deactivate a fruit to remove it from new sales while retaining its history.

## Verification

- Frontend production build: `npm run build`
- Frontend lint: `npm run lint`
- Backend integrity checks: run `npm run test:integrity` from the Backend folder

## Render deployment

Deploy the backend and frontend as separate Render services, and provision a hosted MySQL 8 database with your chosen MySQL provider.

### Backend web service

- Root directory: `Backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `PORT` (Render supplies this), `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `FRONTEND_URL` (the deployed frontend origin, without a trailing slash).
- Run `Backend/database/schema.sql` against the hosted MySQL database, then run `npm run seed` from the Backend directory only if all eight tables are empty.
- After the first deploy, set `FRONTEND_URL` to the static-site URL and redeploy the API.

### Frontend static site

- Root directory: project root
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Build environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com/api`

Do not use localhost addresses in production settings. Never commit `.env` or paste database passwords into GitHub. Enter secrets only into the hosting provider's environment-variable settings. Render free services may sleep while idle; allow time for the backend's first wake-up request.

For assessment submission, provide the live frontend link, public GitHub repository link, and a short recording demonstrating CRUD, purchase/sale stock changes, payments, and reports.
