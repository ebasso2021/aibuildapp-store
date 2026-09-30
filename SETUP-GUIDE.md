# AIBuildApp Store — Setup Guide

Sales, repair and inventory manager for an electronics store (phones, iPads, tablets, laptops, computers). It runs on Google Sheets and Google Apps Script. Your Google Sheet is the database, and the app opens as a web page in any browser.

## What's included

| Module | What it does |
|---|---|
| **Dashboard** | Sales today, net sales, gross and net profit for the month, inventory value, open, ready and overdue repairs, low stock, warranties about to expire |
| **Point of Sale** | Cart, serial/IMEI per line, discount, GST, payment method, printable invoice. A warranty is created automatically for each item that has warranty days |
| **Repairs** | Intake ticket for the device (type, brand, model, IMEI, accessories, condition, problem). Also tracks technician, priority, promised date, estimate and deposit. Status workflow: Received → Diagnosing → Waiting Approval → Waiting Parts → In Repair → Ready → Delivered. Every status change is logged, and you can print the work order with a customer signature line |
| **Deliver & charge** | Turns the repair (parts + labor) into an invoice, takes the parts out of inventory, and creates the repair warranty |
| **Warranties** | Search by number, IMEI or customer. Shows days left and a 30-day expiry alert. You can record claims, open a warranty repair order with one click, and print the certificate |
| **Customers** | Customer list with full history: repairs, purchases, warranties, total spent and last visit |
| **Inventory** | Products, parts and services, with SKU, category, stock, minimum stock, average cost, price, margin and value |
| **Kardex** | Stock card for each item. Every IN/OUT movement shows running quantity, **weighted-average cost** and value. You can print it or export it to CSV |
| **Purchases / Suppliers** | Receiving stock updates quantities and average cost automatically |
| **Expenses** | Operating costs by category: rent, payroll, utilities and more |
| **Reports** | Income statement (net sales, COGS, gross profit, expenses, net profit), tax collected, sales by payment method, top products and customers, repair turnaround, technician performance, CSV exports |
| **Settings** | Store info, tax rate and label (default 5 % GST for Alberta), technicians, warranty and repair terms, English/Spanish toggle |

## Install (about 10 minutes)

1. Open the Google Sheet **AIBuildApp Store – Database** in your Drive folder **AIBuildApp Store**.
2. In the Sheet, go to **Extensions → Apps Script**.
3. The editor opens a file called `Code.gs`. Delete everything in it, then paste the full contents of **Code.gs** from the folder.
4. Click **+ (Add a file) → HTML** and name it exactly `Index`. The editor adds `.html` for you. Delete its default content and paste the full contents of **index.html**.
5. Click **Save** (disk icon).
6. In the function dropdown at the top, choose **setup** and click **Run**. Approve the permissions when asked (*Advanced → Go to project → Allow*). This creates all the tabs: Customers, Products, Kardex, Sales, Repairs, Warranties and the rest.
7. Click **Deploy → New deployment**, then the gear icon → **Web app**:
   - **Execute as:** *Me* if only you will use it. Choose *User accessing the web app* if staff will use it too (see Security below).
   - **Who has access:** *Only myself*, or *Anyone with Google account* for staff.
   - Click **Deploy** and copy the **Web app URL**. That URL is your app, so bookmark it on every computer and tablet you use at the counter.
8. Open the URL, go to **Settings**, and enter your store name, address, phone, tax rate and technicians.
   - To try the app first, click **Load demo data** in Settings. It only appears while the database is empty.
   - To remove the demo data later, delete its rows from the Sheet tabs.

### Updating the app later

If you paste a new version of the code, open **Deploy → Manage deployments → Edit (pencil)**, set **Version** to *New version*, then click **Deploy**. The URL stays the same.

## Barcodes

There are three ways to read a barcode:

1. **USB or Bluetooth barcode scanner** (recommended at the counter).
   - Any scanner that works in "keyboard mode" works. Most do out of the box.
   - Scan anywhere in the app:
     - in **Point of Sale**, the item goes into the cart;
     - on a repair order, the part is added;
     - on any other screen, the app finds and opens what you scanned.
   - What it can find: an invoice (INV-), repair order (RO-), warranty (WAR-), product, or a serial/IMEI.
   - Scanning into a field (barcode, Serial/IMEI, search) fills that field.
2. **Camera**: click the barcode icon (top bar, POS search, Serial/IMEI fields, repair parts, inventory and warranty search).
   - It uses the phone, tablet or laptop camera.
   - If the browser blocks live camera access inside the Google web app, use **Photo** instead: take a picture of the barcode and it is decoded.
3. **Type the code** in the same scan window.

Setup:

- **Products:** each product has a **Barcode (UPC/EAN)** field, plus its SKU. Both can be scanned.
- **Labels:** items without a barcode can get one. Go to **Inventory → Labels** to print Code 128 labels with the store name, product name and price.
- **Documents:** invoices, work orders and warranty certificates print with their number as a barcode. Scan the paper to open the record.
- **Internet:** the camera reader and label printer load small open-source libraries (ZXing, JsBarcode) from the internet the first time they are used.

## Run the app from GitHub Pages

You can open the app from GitHub instead of the Google link, for example:

`https://ebasso2021.github.io/aibuildapp-store/`

- **Where data is kept:** the page on GitHub is only the screens. Your data still lives in the Google Sheet. The page talks to your Apps Script over the internet, protected by an **access key**.
- **Why this is better for scanning:** the page runs outside Google's frame, so **live camera barcode scanning works better** from GitHub Pages.

### One-time setup

1. **Update Apps Script.**
   - In the Sheet, go to **Extensions → Apps Script**.
   - Paste the new **Code.gs**, and paste **index.html** into the `Index` file.
   - Click **Save**, then run **setup** once. This creates the access key.
2. **Get your access key.** Reload the Sheet, then use the menu **Store App → Show access key**. Copy the key.
   - Treat it like a password.
   - If it leaks, use **Store App → Create a NEW access key**. Every device will need the new key.
3. **Deploy the API.**
   - Go to **Deploy → New deployment → Web app**.
   - Set **Execute as: Me** and **Who has access: Anyone**.
   - Click **Deploy** and copy the URL that ends in **/exec**.
   - *"Anyone" is required so the GitHub page can reach it. Without the access key, the API refuses all requests.*
4. **Turn on GitHub Pages.**
   - In the repo, go to **Settings → Pages**.
   - Under **Source**, choose **Deploy from a branch**.
   - Choose branch **main**, folder **/ (root)**, then click **Save**.
   - After a minute or two, the page is live at `https://ebasso2021.github.io/aibuildapp-store/`.
   - *GitHub Pages on a free account needs the repository to be **public**. The code is public; your data and key are not in it.*
5. **Connect each device.**
   - Open the GitHub Pages link.
   - Paste the **Web app URL (/exec)** and the **access key**, and type your name. Then click **Connect**.
   - The browser remembers this. You can change it later in **Settings → Change connection**.

### Updating later

- **Screen changes (index.html):** push the new file to GitHub. Every device picks it up on reload.
- **Changes to Code.gs:** paste the new code into Apps Script, then go to **Deploy → Manage deployments → Edit** and set **New version**.

## Security (important)

- The app reads and writes the Sheet, so **anyone who can open the app can see all of your store's data**.
- **Just you:** set *Execute as: Me* and *Only myself*.
- **Staff:**
  1. Share the Google Sheet with each employee's Google account (Editor).
  2. Deploy with *Execute as: User accessing the web app* and *Anyone with Google account*.
  3. People who don't have access to the Sheet can't read the data.
- *Execute as: Me* + *Anyone* is only safe because every request needs the **access key**. Never publish the key, and don't put backups or exported CSVs in the GitHub repo.

## Working offline / testing

`index.html` also works on its own: double-click it to open it in Chrome or Edge. In that mode it runs in **Local mode** and stores data only in that browser. This is useful for testing or training.

- Use **Settings → Export backup (JSON)** to keep a copy.
- For the real store, use the Google Sheets deployment.

## How the numbers work

- **Stock and cost:** every movement is recorded in the Kardex. Cost uses the **weighted-average method**: a purchase at a new cost recalculates the average, and sales and repair parts leave at the current average.
- **Profit:** each sale stores its cost at the moment of sale.
  - Gross profit = net sales (after discount, before tax) − cost of goods sold.
  - Net profit = gross profit − expenses in Expenses.
- **Voiding a sale:**
  - returns items to stock (Kardex "Sale void")
  - voids the related warranties
  - sends a repair back to *Ready*
- **Numbering:** numbering is automatic and sequential: INV-00001, RO-00001, WAR-00001, PO-00001.
- **Tax:** the default is 5 % (Alberta charges GST only, with no provincial sales tax). You can change the rate and label in Settings.

## Notes and limits

- For a small shop, Google Sheets comfortably handles tens of thousands of rows. If it gets slow after several years, archive old Kardex and Sales rows to another Sheet.
- Printing uses your browser's print dialog, and works with a regular printer or "Save as PDF". Thermal receipt printers work if they are set up as a system printer.
- The app does not process card payments. It only records the payment method used.
- Repair warranties and terms texts are editable templates. Have them reviewed for your store's needs.
