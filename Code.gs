/**
 * AIBuildApp Store — Electronics Sales & Repair Management
 * Backend for Google Apps Script (bound to a Google Sheet).
 * The Google Sheet is the database: one tab per table.
 *
 * Setup: Extensions > Apps Script > paste this file as Code.gs and the UI as Index.html
 *        > run setup() once > Deploy > New deployment > Web app.
 *
 * The same deployment also works as a JSON API for the GitHub Pages version of the app
 * (POST to the /exec URL). Every API call must carry the store ACCESS KEY
 * (created by setup(); see it with the "Store App > Show access key" menu).
 */

const SCHEMA = {
  Settings:   ['id', 'value'],
  Customers:  ['id', 'name', 'phone', 'email', 'address', 'notes', 'createdAt'],
  Suppliers:  ['id', 'name', 'contact', 'phone', 'email', 'notes', 'createdAt'],
  Products:   ['id', 'sku', 'barcode', 'name', 'kind', 'category', 'brand', 'model', 'price', 'avgCost', 'stock',
               'minStock', 'warrantyDays', 'location', 'active', 'createdAt'],
  Kardex:     ['id', 'date', 'productId', 'sku', 'type', 'ref', 'qtyIn', 'qtyOut', 'unitCost',
               'balanceQty', 'balanceAvgCost', 'balanceValue', 'notes', 'user'],
  Purchases:  ['id', 'number', 'date', 'supplierId', 'invoiceRef', 'items', 'total', 'notes', 'user'],
  Sales:      ['id', 'number', 'date', 'customerId', 'items', 'subtotal', 'discount', 'tax', 'total',
               'cost', 'profit', 'payment', 'status', 'repairId', 'notes', 'user'],
  Repairs:    ['id', 'number', 'dateIn', 'customerId', 'deviceType', 'brand', 'model', 'serial',
               'accessories', 'condition', 'problem', 'diagnosis', 'technician', 'status', 'priority',
               'promisedDate', 'estimate', 'labor', 'parts', 'deposit', 'total', 'warrantyDays',
               'warrantyId', 'dateOut', 'saleId', 'history', 'notes'],
  Warranties: ['id', 'number', 'type', 'refId', 'refNumber', 'customerId', 'description', 'serial',
               'startDate', 'endDate', 'status', 'claims', 'notes'],
  Expenses:   ['id', 'date', 'category', 'description', 'amount', 'payment', 'supplierId', 'notes', 'user']
};

const PREFIX = { Sales: 'INV-', Repairs: 'RO-', Warranties: 'WAR-', Purchases: 'PO-' };

/* ---------- Web app entry ----------
 * The app screens run on GitHub Pages; this script is only the API + database.
 * Opening the /exec link in a browser shows a short page with a link to the app.
 * (If you also keep an HTML file named "Index" in this project, it is served instead.)
 */
const APP_URL = 'https://ebasso2021.github.io/aibuildapp-store/';

function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('AIBuildApp Store')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,Arial;padding:30px;max-width:560px">' +
      '<h2>AIBuildApp Store API is running</h2>' +
      '<p>This link is the database connection for the store app. Open the app here:</p>' +
      '<p><a href="' + APP_URL + '" target="_top" style="font-size:18px">' + APP_URL + '</a></p></div>'
    ).setTitle('AIBuildApp Store API');
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Store App')
    .addItem('1) Setup / repair tabs', 'setup')
    .addItem('2) Show access key', 'showAccessKey')
    .addItem('3) Create a NEW access key (logs out every device)', 'resetAccessKey')
    .addToUi();
}

/* ---------- Access key (protects the API) ---------- */
function getKey_() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('API_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); props.setProperty('API_KEY', k); }
  return k;
}
function isOwner_() {
  try {
    const a = Session.getActiveUser().getEmail(), o = Session.getEffectiveUser().getEmail();
    return !!a && a === o;
  } catch (e) { return false; }
}
function checkAccess_(key) {
  if (isOwner_()) return;
  if (!key || String(key) !== getKey_()) throw new Error('INVALID_KEY');
}
function showAccessKey() {
  const k = getKey_();
  Logger.log('Access key: ' + k);
  try { SpreadsheetApp.getUi().alert('Store access key', k, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return k;
}
function resetAccessKey() {
  PropertiesService.getScriptProperties().deleteProperty('API_KEY');
  return showAccessKey();
}

/* ---------- JSON API for the GitHub Pages app ----------
 * POST body (sent as text/plain to avoid CORS preflight):
 *   {"key":"...","action":"ping"|"load"|"commit","ops":[...]}
 * Response: {"ok":true,"data":...} or {"ok":false,"error":"..."}
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkAccess_(req.key);
    let data;
    if (req.action === 'ping') data = '{"store":' + JSON.stringify(SpreadsheetApp.getActiveSpreadsheet().getName()) + '}';
    else if (req.action === 'load') data = apiLoad_();
    else if (req.action === 'commit') data = apiCommit_(JSON.stringify(req.ops || []));
    else throw new Error('Unknown action');
    out = '{"ok":true,"data":' + data + '}';
  } catch (err) {
    out = JSON.stringify({ ok: false, error: String((err && err.message) || err) });
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Calls from the Apps Script-hosted page (google.script.run) ---------- */
function apiLoad(key) { checkAccess_(key); return apiLoad_(); }
function apiCommit(opsJson, key) { checkAccess_(key); return apiCommit_(opsJson); }

/* ---------- One-time setup: creates every tab with its headers ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const lastCol = sh.getLastColumn();
    const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String) : [];
    SCHEMA[name].forEach(function (c) { if (headers.indexOf(c) < 0) headers.push(c); });
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  getKey_();
  ['Sheet1', 'Hoja 1', 'Hoja1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  return 'OK';
}

/* ---------- Helpers ---------- */
function sheet_(name) {
  if (!SCHEMA[name]) throw new Error('Unknown table: ' + name);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { setup(); sh = ss.getSheetByName(name); }
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function cellOut_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function cellIn_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
  if (typeof v === 'string' && (v.charAt(0) === '[' || v.charAt(0) === '{')) {
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  return v;
}

function nextSeq_(table) {
  const sh = sheet_('Settings');
  const key = 'seq_' + table;
  const last = sh.getLastRow();
  const ids = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === key) {
      const n = (Number(ids[i][1]) || 0) + 1;
      sh.getRange(i + 2, 2).setValue(n);
      return (PREFIX[table] || '') + String(n).padStart(5, '0');
    }
  }
  sh.appendRow([key, 1]);
  return (PREFIX[table] || '') + '00001';
}

/* ---------- API: load everything ---------- */
function apiLoad_() {
  const tz = Session.getScriptTimeZone();
  const out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    const sh = sheet_(name);
    const values = sh.getDataRange().getValues();
    const h = values.shift() || [];
    out[name] = values.filter(function (r) { return r[0] !== '' && r[0] !== null; }).map(function (r) {
      const o = {};
      h.forEach(function (k, i) { if (k) o[k] = cellIn_(r[i], tz); });
      return o;
    });
  });
  out._user = Session.getActiveUser().getEmail() || '';
  return JSON.stringify(out);
}

/* ---------- API: apply a batch of operations under a lock ----------
 * ops = [{table, action:'upsert'|'delete', record:{id,...}}]
 * number === 'AUTO' gets the next sequence number (INV-00001 ...).
 * Any top-level string "@@num:<id>" is replaced by that record's number.
 */
function apiCommit_(opsJson) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ops = JSON.parse(opsJson);
    const nums = {};
    const idx = {};   // table -> {sh, headers, ids[]}
    const saved = [];
    ops.forEach(function (op) {
      if (!idx[op.table]) {
        const sh = sheet_(op.table);
        const last = sh.getLastRow();
        idx[op.table] = {
          sh: sh,
          headers: headers_(sh),
          ids: last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : []
        };
      }
      const T = idx[op.table];
      const rec = op.record || {};
      const pos = T.ids.indexOf(String(rec.id));
      if (op.action === 'delete') {
        if (pos >= 0) { T.sh.deleteRow(pos + 2); T.ids.splice(pos, 1); }
      } else {
        if (rec.number === 'AUTO') rec.number = nextSeq_(op.table);
        if (rec.number) nums[rec.id] = rec.number;
        Object.keys(rec).forEach(function (k) {
          if (typeof rec[k] === 'string' && rec[k].indexOf('@@num:') === 0) rec[k] = nums[rec[k].slice(6)] || '';
        });
        const row = T.headers.map(function (h) { return cellOut_(rec[h]); });
        const fmts = row.map(function (v) { return typeof v === 'number' ? 'General' : '@'; });
        let r;
        if (pos >= 0) r = pos + 2;
        else { r = T.sh.getLastRow() + 1; T.ids.push(String(rec.id)); }
        const rng = T.sh.getRange(r, 1, 1, row.length);
        rng.setNumberFormats([fmts]);
        rng.setValues([row]);
      }
      saved.push({ table: op.table, action: op.action, record: rec });
    });
    SpreadsheetApp.flush();
    return JSON.stringify(saved);
  } finally {
    lock.releaseLock();
  }
}
