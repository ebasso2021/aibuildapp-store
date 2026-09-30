/**
 * AIBuildApp Store — Electronics Sales & Repair Management
 * Backend for Google Apps Script (bound to the Google Sheet "AIBuildApp Store – Database").
 *
 * The app screens run on GitHub Pages (index.html). This script is the API + database:
 *   - The Google Sheet is the database (one tab per table).
 *   - Users sign in with username + password. Two roles:
 *       Administrator : full access
 *       Technician    : repairs, warranties, customers (contact only) and parts lookup (no costs,
 *                       no sales, no reports, no settings, cannot charge/deliver repairs)
 *   - Every rule is enforced HERE on the server, not only in the screens.
 *
 * Setup: paste this file as Code.gs > Save > run setup() once (it creates the tabs and the first
 *        "admin" user and shows its temporary password) > Deploy > Web app
 *        (Execute as: Me, Who has access: Anyone).
 */

const SCHEMA = {
  Settings:   ['id', 'value'],
  Users:      ['id', 'username', 'name', 'role', 'active', 'salt', 'hash', 'createdAt', 'lastLogin'],
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
const DATA_TABLES = ['Settings', 'Customers', 'Suppliers', 'Products', 'Kardex', 'Purchases', 'Sales', 'Repairs', 'Warranties', 'Expenses'];
const PREFIX = { Sales: 'INV-', Repairs: 'RO-', Warranties: 'WAR-', Purchases: 'PO-' };

/* What a Technician may READ (true = all columns, array = only those columns) */
const TECH_READ = {
  Settings: true,
  Customers: ['id', 'name', 'phone', 'email', 'createdAt'],
  Products: ['id', 'sku', 'barcode', 'name', 'kind', 'category', 'brand', 'model', 'price', 'stock',
             'minStock', 'warrantyDays', 'location', 'active'],
  Repairs: true,
  Warranties: true
};
/* What a Technician may WRITE (create / update only, never delete) */
const TECH_WRITE = { Repairs: true, Customers: true, Warranties: true };

const SESSION_SECONDS = 6 * 60 * 60;   // sign-in lasts 6 hours of inactivity
const APP_URL = 'https://ebasso2021.github.io/aibuildapp-store/';

/* ======================= Web entry points ======================= */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,Arial;padding:30px;max-width:560px">' +
    '<h2>AIBuildApp Store API is running</h2>' +
    '<p>This link is the database connection for the store app. Open the app here:</p>' +
    '<p><a href="' + APP_URL + '" target="_top" style="font-size:18px">' + APP_URL + '</a></p></div>'
  ).setTitle('AIBuildApp Store API');
}

/* POST body is JSON sent as text/plain (no CORS preflight):
 *   {"action":"login","username":"...","password":"..."}  -> {token,user}
 *   {"action":"load"|"commit"|..., "token":"...", ...}
 * Response: {"ok":true,"data":...} | {"ok":false,"error":"AUTH"|"FORBIDDEN"|message}
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = JSON.stringify({ ok: true, data: handle_(req) });
  } catch (err) {
    out = JSON.stringify({ ok: false, error: String((err && err.message) || err) });
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  const a = req.action;
  if (a === 'ping') return { store: SpreadsheetApp.getActiveSpreadsheet().getName() };
  if (a === 'login') return login_(req.username, req.password);
  const s = session_(req.token);
  switch (a) {
    case 'logout':   CacheService.getScriptCache().remove('S_' + req.token); return {};
    case 'me':       return s;
    case 'load':     return load_(s);
    case 'commit':   return commit_(s, req.ops || []);
    case 'password': return changePassword_(s, req.oldPassword, req.newPassword);
    case 'users.list':   admin_(s); return listUsers_();
    case 'users.save':   admin_(s); return saveUser_(s, req.user || {});
    case 'users.delete': admin_(s); return deleteUser_(s, req.id);
  }
  throw new Error('Unknown action');
}

/* ======================= Sheet menu & setup ======================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Store App')
    .addItem('1) Setup / repair tabs', 'setup')
    .addItem('2) Reset "admin" password', 'resetAdminPassword')
    .addToUi();
}

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
  ['Sheet1', 'Hoja 1', 'Hoja1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  const users = readTable_('Users');
  if (!users.some(function (u) { return u.role === 'Administrator' && u.active !== 'No'; })) return resetAdminPassword();
  return 'OK';
}

/* Creates (or resets) the user "admin" with a new temporary password and shows it. */
function resetAdminPassword() {
  const pwd = randomPassword_();
  const users = readTable_('Users');
  const ex = users.filter(function (u) { return String(u.username).toLowerCase() === 'admin'; })[0];
  const salt = Utilities.getUuid();
  const rec = ex || { id: Utilities.getUuid(), username: 'admin', name: 'Administrator', createdAt: now_() };
  rec.role = 'Administrator'; rec.active = 'Yes'; rec.salt = salt; rec.hash = hash_(pwd, salt);
  writeRows_('Users', [rec]);
  const msg = 'Username: admin\nPassword: ' + pwd + '\n\nSign in at ' + APP_URL + ' and change this password in "My account".';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Store administrator', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return msg;
}

/* ======================= Security helpers ======================= */
function hash_(password, salt) {
  let h = salt + '|' + password;
  for (let i = 0; i < 300; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + salt)
      .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
  }
  return h;
}
function randomPassword_() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i++) p += c.charAt(Math.floor(Math.random() * c.length));
  return p;
}
function publicUser_(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin };
}
function login_(username, password) {
  username = String(username || '').trim().toLowerCase();
  if (!username || !password) throw new Error('LOGIN_FAILED');
  const cache = CacheService.getScriptCache();
  const failKey = 'F_' + username;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) throw new Error('LOCKED');
  const u = readTable_('Users').filter(function (x) { return String(x.username).toLowerCase() === username; })[0];
  if (!u || u.active === 'No' || hash_(String(password), u.salt) !== u.hash) {
    cache.put(failKey, String(fails + 1), 600);   // 5 failures = locked 10 minutes
    throw new Error('LOGIN_FAILED');
  }
  cache.remove(failKey);
  u.lastLogin = now_();
  writeRows_('Users', [u]);
  const token = Utilities.getUuid() + Utilities.getUuid();
  const s = { id: u.id, username: u.username, name: u.name || u.username, role: u.role };
  cache.put('S_' + token, JSON.stringify(s), SESSION_SECONDS);
  return { token: token, user: s };
}
function session_(token) {
  if (!token) throw new Error('AUTH');
  const cache = CacheService.getScriptCache();
  const v = cache.get('S_' + token);
  if (!v) throw new Error('AUTH');
  cache.put('S_' + token, v, SESSION_SECONDS);  // sliding expiry
  return JSON.parse(v);
}
function admin_(s) { if (s.role !== 'Administrator') throw new Error('FORBIDDEN'); }

/* ======================= Users (admin only) ======================= */
function listUsers_() { return readTable_('Users').map(publicUser_); }
function saveUser_(s, u) {
  const users = readTable_('Users');
  const uname = String(u.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(uname)) throw new Error('Username: 3-30 letters, numbers, dot, dash or underscore');
  if (['Administrator', 'Technician'].indexOf(u.role) < 0) throw new Error('Invalid role');
  if (users.some(function (x) { return String(x.username).toLowerCase() === uname && x.id !== u.id; })) throw new Error('Username already exists');
  const ex = u.id ? users.filter(function (x) { return x.id === u.id; })[0] : null;
  if (!ex && !u.password) throw new Error('Password required for a new user');
  if (u.password && String(u.password).length < 6) throw new Error('Password must have at least 6 characters');
  if (ex && ex.id === s.id && (u.role !== 'Administrator' || u.active === 'No')) throw new Error('You cannot remove your own administrator access');
  const rec = ex || { id: Utilities.getUuid(), createdAt: now_() };
  rec.username = uname; rec.name = String(u.name || uname); rec.role = u.role; rec.active = u.active === 'No' ? 'No' : 'Yes';
  if (u.password) { rec.salt = Utilities.getUuid(); rec.hash = hash_(String(u.password), rec.salt); }
  writeRows_('Users', [rec]);
  return publicUser_(rec);
}
function deleteUser_(s, id) {
  if (id === s.id) throw new Error('You cannot delete yourself');
  const sh = sheet_('Users');
  const pos = colIds_(sh).indexOf(String(id));
  if (pos >= 0) sh.deleteRow(pos + 2);
  return {};
}
function changePassword_(s, oldP, newP) {
  const u = readTable_('Users').filter(function (x) { return x.id === s.id; })[0];
  if (!u || hash_(String(oldP || ''), u.salt) !== u.hash) throw new Error('Current password is wrong');
  if (!newP || String(newP).length < 6) throw new Error('Password must have at least 6 characters');
  u.salt = Utilities.getUuid(); u.hash = hash_(String(newP), u.salt);
  writeRows_('Users', [u]);
  return {};
}

/* ======================= Data: load & commit ======================= */
function load_(s) {
  const out = {};
  const tech = s.role !== 'Administrator';
  DATA_TABLES.forEach(function (name) {
    if (tech && !TECH_READ[name]) { out[name] = []; return; }
    let rows = readTable_(name);
    const cols = tech ? TECH_READ[name] : true;
    if (Array.isArray(cols)) rows = rows.map(function (r) { const o = {}; cols.forEach(function (c) { o[c] = r[c]; }); return o; });
    out[name] = rows;
  });
  out.Users = tech ? [] : listUsers_();
  out._user = s.name;
  out._session = s;
  return out;
}

function commit_(s, ops) {
  const tech = s.role !== 'Administrator';
  if (tech) {
    ops.forEach(function (op) {
      if (op.action !== 'upsert' || !TECH_WRITE[op.table]) throw new Error('FORBIDDEN');
    });
  }
  const tz = Session.getScriptTimeZone();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const nums = {}, idx = {}, saved = [];
    ops.forEach(function (op) {
      if (DATA_TABLES.indexOf(op.table) < 0) throw new Error('Unknown table: ' + op.table);
      if (!idx[op.table]) {
        const sh = sheet_(op.table);
        idx[op.table] = { sh: sh, headers: headers_(sh), ids: colIds_(sh) };
      }
      const T = idx[op.table];
      const rec = op.record || {};
      const pos = T.ids.indexOf(String(rec.id));
      if (op.action === 'delete') {
        if (pos >= 0) { T.sh.deleteRow(pos + 2); T.ids.splice(pos, 1); }
        saved.push({ table: op.table, action: 'delete', record: { id: rec.id } });
        return;
      }
      /* existing row values are kept for any field the record does not send */
      const old = {};
      if (pos >= 0) {
        const vals = T.sh.getRange(pos + 2, 1, 1, T.headers.length).getValues()[0];
        T.headers.forEach(function (h, i) { old[h] = vals[i]; });
      }
      if (tech && op.table === 'Repairs') {
        const oldStatus = pos >= 0 ? String(old.status) : '';
        if (oldStatus === 'Delivered' || rec.status === 'Delivered') throw new Error('FORBIDDEN');
        ['saleId', 'dateOut', 'warrantyId'].forEach(function (k) { delete rec[k]; });
      }
      if (rec.number === 'AUTO') rec.number = nextSeq_(op.table);
      if (rec.number) nums[rec.id] = rec.number;
      Object.keys(rec).forEach(function (k) {
        if (typeof rec[k] === 'string' && rec[k].indexOf('@@num:') === 0) rec[k] = nums[rec[k].slice(6)] || '';
      });
      const row = T.headers.map(function (h) {
        return Object.prototype.hasOwnProperty.call(rec, h) ? cellOut_(rec[h]) : (old[h] === undefined ? '' : old[h]);
      });
      const fmts = row.map(function (v) { return typeof v === 'number' ? 'General' : '@'; });
      let r;
      if (pos >= 0) r = pos + 2;
      else { r = T.sh.getLastRow() + 1; T.ids.push(String(rec.id)); }
      const rng = T.sh.getRange(r, 1, 1, row.length);
      rng.setNumberFormats([fmts]);
      rng.setValues([row]);
      const back = {};
      const cols = tech && Array.isArray(TECH_READ[op.table]) ? TECH_READ[op.table] : T.headers;
      T.headers.forEach(function (h, i) { if (h && cols.indexOf(h) >= 0) back[h] = cellIn_(row[i], tz); });
      saved.push({ table: op.table, action: 'upsert', record: back });
    });
    SpreadsheetApp.flush();
    return saved;
  } finally {
    lock.releaseLock();
  }
}

/* ======================= Sheet helpers ======================= */
function now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"); }
function sheet_(name) {
  if (!SCHEMA[name]) throw new Error('Unknown table: ' + name);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function headers_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; }
function colIds_(sh) {
  const last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
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
function readTable_(name) {
  const tz = Session.getScriptTimeZone();
  const values = sheet_(name).getDataRange().getValues();
  const h = values.shift() || [];
  return values.filter(function (r) { return r[0] !== '' && r[0] !== null; }).map(function (r) {
    const o = {};
    h.forEach(function (k, i) { if (k) o[k] = cellIn_(r[i], tz); });
    return o;
  });
}
function writeRows_(name, recs) {
  const sh = sheet_(name), headers = headers_(sh), ids = colIds_(sh);
  recs.forEach(function (rec) {
    const row = headers.map(function (h) { return cellOut_(rec[h]); });
    const pos = ids.indexOf(String(rec.id));
    const r = pos >= 0 ? pos + 2 : sh.getLastRow() + 1;
    if (pos < 0) ids.push(String(rec.id));
    const rng = sh.getRange(r, 1, 1, row.length);
    rng.setNumberFormats([row.map(function (v) { return typeof v === 'number' ? 'General' : '@'; })]);
    rng.setValues([row]);
  });
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
