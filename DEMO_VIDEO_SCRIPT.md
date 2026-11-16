# Demo video walkthrough (about 3 minutes)

## Before recording

- Start MySQL and the backend from `Backend` with `npm run dev`.
- Start the frontend from the project root with `npm run dev`.
- Open `http://localhost:5173`, refresh once, and wait for the data to load.
- Close extra tabs and hide notifications. Do not show `.env`, passwords, or other credentials.
- The walkthrough below records one new purchase, one sale, and a payment in the database. Those are real records and will remain after filming; do not run the seed script again.

## Suggested narration and actions

### 0:00–0:25 — Dashboard

**Say:** “This is the Batloung Farm Distribution System. The dashboard summarizes suppliers, vendors, available fruit varieties, sales, low stock, and outstanding balances. The application is connected to its Node.js API and MySQL database.”

Show the dashboard cards and recent sales/stock-watch panel.

### 0:25–0:55 — Supplier, fruit, and vendor records

Click **Suppliers**, **Fruits**, and **Vendors**. Point out the seeded records and the row actions. Click **View** on a fruit and show its size-specific prices and Available status; close the dialog. Briefly show vendor search by entering `Maseru`, then clear the search.

**Say:** “Supplier, fruit, and vendor records can be viewed and edited. Fruits have separate small, medium, and large selling prices. Referenced history is protected from deletion.”

### 0:55–1:25 — Purchase and stock

Click **Purchases**, then the floating **+** button. Add a purchase:

- Supplier: Highveld Fresh Produce
- Purchase date: today
- Fruit: Bananas
- Package size: Large
- Quantity: 2
- Unit cost: 14.00

Click **Save purchase & update stock**. Then click **Stock** and point out that Bananas / Large has increased to 2 boxes.

**Say:** “A purchase can contain multiple fruit items. The system calculates its total and increases stock for the matching fruit and package size in a database transaction.”

### 1:25–2:00 — Sale and automatic price

Click **Sales**, then **+**. Enter:

- Vendor: Roma Fresh Corner
- Sale date: today
- Payment method: Credit / unpaid
- Amount paid now: 0
- Fruit: Bananas
- Package size: Large
- Quantity: 1

Click **Save sale & update stock**. Point out the sale total of M 38.00 and the stock decrease to 1 large box. If the demo database differs, select a fruit/size with enough stock and use the catalogue price shown.

**Say:** “Sale prices are loaded from the fruit catalogue. Stock is checked before the entire transaction saves, and an unavailable quantity is rejected without a partial sale.”

### 2:00–2:25 — Payment and reports

Click **Payments**. The new sale should appear as unpaid with M 38.00 due. Click **+**, choose that sale, enter M 10.00, select Mobile money, and apply the payment. Show the partial status and remaining M 28.00 balance. Then open **Reports** and show revenue, top-selling fruit/vendor, stock, and vendor outstanding balances.

**Say:** “Payments update the paid amount and payment status. Reports show sales revenue by date range, top-selling fruit, the top vendor, stock by package size, and outstanding balances.”

### 2:25–2:40 — Finish

**Say:** “This demonstrates the Batloung Farm system’s supplier, fruit, vendor, purchase, sales, stock, payment, and reporting workflows.”

## Recording on Windows

Use Xbox Game Bar: open the dashboard, press **Win+Alt+R** to start recording, perform the walkthrough, then press **Win+Alt+R** again to stop. If Game Bar is disabled, open **Snipping Tool → Record → New**, select the browser area, and start recording. Review the saved video before submitting to ensure no credentials or private information are visible.
