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
3. The editor opens a file called `Code.gs`. Delete everything in it, paste the full contents of **Code.gs**, then click **Save**.
   - No HTML file is needed in Apps Script. The screens run from GitHub.
4. In the function dropdown at the top, choose **setup** and click **Run**.
   - Approve the permissions when asked (*Advanced → Go to project → Allow*).
   - This creates all the tabs and the first user, **admin**. Its temporary password appears in the **Execution log**.
5. Click **Deploy → New deployment**, then the gear icon → **Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**.
6. Open `https://ebasso2021.github.io/aibuildapp-store/` and sign in as **admin**. Then:
   - Change the password in **My account**.
   - Enter your store details in **Settings**.
   - Create your technicians in **Users**.
   - To try the app first, click **Load demo data** in Settings. It only appears while the database is empty.

### Updating the app later

- **Screens:** push the new `index.html` to GitHub.
- **Script:** paste the new `Code.gs` into Apps Script, then go to **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

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

The app runs at `https://ebasso2021.github.io/aibuildapp-store/`.

- **GitHub** holds only the screens (`index.html`).
- **Google** holds the script (`Code.gs`) and the data (the Google Sheet).
- **Sign-in:** everyone signs in with a **username and password**.

### One-time setup

1. **Update Apps Script.**
   - In the Sheet, go to **Extensions → Apps Script**.
   - Replace all of `Code.gs` with the new version, then click **Save**.
2. **Run setup.** Choose **setup** in the function dropdown and click **Run**.
   - This adds the **Users** tab and creates the first user: **admin**.
   - Its temporary password appears in the **Execution log** at the bottom. Copy it.
3. **Deploy.**
   - Go to **Deploy → Manage deployments → Edit (pencil)**.
   - Set **Version: New version**, **Execute as: Me**, **Who has access: Anyone**, then click **Deploy**. The link stays the same.
4. **Turn on GitHub Pages** (only once).
   - In the repo, go to **Settings → Pages → Deploy from a branch → main → / (root)**.
   - The repository must be public on a free GitHub account.
5. **Sign in as admin.**
   - Open the app and sign in with **admin** and the temporary password.
   - Right away, go to **My account → Change password**.

## Users and roles

| | Administrator | Technician |
|---|---|---|
| Dashboard | Full business dashboard | Repair dashboard + "My open repairs" |
| Repairs | Everything, including **Deliver & charge** | Create, edit, diagnose, add parts, change status. **Cannot** deliver/charge or edit a delivered repair |
| Warranties | Everything | View, search, record claims, open a warranty repair |
| Customers | Everything, including purchases and total spent | Name, phone and email only. Can add customers and edit contact info. No purchase history or totals |
| Parts & stock | Full inventory, costs, margins, kardex, labels | Stock, location, price and warranty. **No costs** |
| POS, Sales, Kardex, Purchases, Suppliers, Expenses, Reports, Settings, Users | Yes | No |

- **Adding a user:** go to **Users → New user**. Choose the role and a password of at least 6 characters.
- **Switching a user off:** set **Active: No**. That user can't sign in any more, and their name stays on old records.
- **Resetting a password:** edit the user and type a new one.
- **Every user's own account:** each person can change their own password in **My account**.
- **Forgotten admin password:** in the Sheet, use **Store App → Reset "admin" password**. You can also run `resetAdminPassword` in Apps Script. The new password appears in the Execution log.

## Security (important)

- **Rules are enforced in Google, not just hidden on screen.** A technician who tries to read sales or costs, or to charge a repair, is refused by the script, even with browser tricks.
- **Passwords are never stored.** The Users tab only has a salted hash.
- **Failed sign-ins:** after 5 failed attempts, that username is locked for 10 minutes.
- **Session length:** a session lasts 6 hours after the last activity. Use **Sign out** on shared computers.
- **Who can see the Sheet:** only you (the owner) should have access to the Google Sheet itself. Don't share the Sheet with technicians, because they would see everything there. They only need their app user.
- **"Anyone" access:** it's needed so the GitHub page can reach the script. Every data request still requires a signed-in user.
- **Keep data out of GitHub:** never put backups or exported CSVs in the GitHub repo.

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
