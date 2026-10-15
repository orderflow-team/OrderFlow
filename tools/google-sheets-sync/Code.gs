/**
 * OBIX360 -> Google Sheet sales sync (Google Apps Script).
 *
 * Pulls every order line from  GET <base>/api/sheets-sync/order-lines  with the static
 * key in the x-sync-key header, keeps them in the "Order Lines" tab, and builds two
 * summary tabs ("Store Sales", "Items Sold") with QUERY formulas. Nothing Google-related
 * is stored on the OBIX360 server.
 *
 * Setup: see README.md in this folder. Paste this file into Extensions > Apps Script,
 * save, reload the sheet, then use the "OBIX360 Sync" menu.
 *
 * Where things are stored:
 *   Script properties (private to people who can edit the script): BASE_URL, KEY, CURSOR, LAST_SYNC.
 *   The key is never written into a sheet cell.
 */

var SHEET_LINES = 'Order Lines';
var SHEET_STORES = 'Store Sales';
var SHEET_ITEMS = 'Items Sold';

var BATCH_LIMIT = 300; // orders per request (server maximum is 500)
var TIME_BUDGET_MS = 4.5 * 60 * 1000; // stop fetching before Apps Script's 6 minute limit
var TRIGGER_FUNCTION = 'syncNow';

// Column order of the "Order Lines" tab. The QUERY formulas below refer to these letters:
// A id, B number, C created, D store, E customer, F status, G origin, H item, I qty, J unit,
// K unit price, L subtotal, M tax %, N line tax, O returned qty, P net qty, Q orders,
// R order revenue, S order tax, T net subtotal.
var HEADERS = [
  'Order ID', 'Order #', 'Created', 'Store', 'Customer', 'Status', 'Origin', 'Item',
  'Qty', 'Unit', 'Unit price', 'Line subtotal', 'Tax %', 'Line tax', 'Returned qty',
  'Net qty', 'Orders (1 on first line)', 'Order revenue (first line)', 'Order tax (first line)',
  'Net line subtotal'
];

var NOT_SALE = "F <> 'draft' and F <> 'cancelled' and F <> 'returned'";

/* ----------------------------- pure helpers ----------------------------- */

function num_(v) {
  return v === null || v === undefined || v === '' ? '' : Number(v);
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

/** One API line -> one sheet row (same order as HEADERS). */
function buildRow_(l) {
  var qty = Number(l.quantity) || 0;
  var returned = Number(l.returned_quantity) || 0;
  // Subtotal of what stayed sold: a partly returned line only counts the kept quantity.
  var net = qty > 0 ? (Number(l.subtotal) || 0) * Math.max(qty - returned, 0) / qty : 0;
  return [
    l.order_id,
    l.order_number || '',
    l.created_at ? new Date(l.created_at) : '',
    l.business_name || '',
    l.customer_name || '',
    l.status || '',
    l.origin || '',
    l.product_name || '',
    num_(l.quantity),
    l.unit || '',
    num_(l.unit_price),
    num_(l.subtotal),
    num_(l.tax_percentage),
    num_(l.item_tax),
    num_(l.returned_quantity),
    num_(l.net_quantity),
    num_(l.order_count),
    num_(l.order_revenue),
    num_(l.order_tax),
    round2_(net)
  ];
}

/** Group a batch's lines by order id: { orderId: [row, row, ...] }. Lines arrive in order. */
function groupBatch_(lines) {
  var byOrder = {};
  lines.forEach(function (l) {
    (byOrder[l.order_id] = byOrder[l.order_id] || []).push(buildRow_(l));
  });
  return byOrder;
}

/** Drop every existing row of the changed orders, then add their fresh rows. */
function mergeRows_(existing, changed) {
  var kept = existing.filter(function (r) {
    return !Object.prototype.hasOwnProperty.call(changed, r[0]);
  });
  Object.keys(changed).forEach(function (id) {
    changed[id].forEach(function (r) { kept.push(r); });
  });
  return kept;
}

/* ------------------------------ configuration ---------------------------- */

function props_() {
  return PropertiesService.getScriptProperties();
}

function config_() {
  var p = props_();
  var base = p.getProperty('BASE_URL');
  var key = p.getProperty('KEY');
  return base && key ? { base: base, key: key } : null;
}

function say_(message) {
  Logger.log(message);
  try {
    SpreadsheetApp.getActive().toast(message, 'OBIX360 Sync', 8);
  } catch (e) { /* no UI when run by the timer */ }
}

function alert_(message) {
  try {
    SpreadsheetApp.getUi().alert('OBIX360 Sync', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(message);
  }
}

/* --------------------------------- API ----------------------------------- */

/** Fetch one batch. Throws an Error with a plain-language message on any failure. */
function fetchBatch_(cfg, cursor, limit) {
  var url = cfg.base + '/api/sheets-sync/order-lines?limit=' + limit +
    (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-sync-key': cfg.key },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 401) throw new Error('The server rejected the key (401). Run "1. Connect" again with the current SHEETS_SYNC_KEY.');
  if (code === 404) throw new Error('The sync endpoint is off or the URL is wrong (404). On the server, SHEETS_SYNC_KEY must be set (24+ characters) and the API restarted.');
  if (code === 400) throw new Error('The server rejected the sync position (400). Run "Full resync".');
  if (code !== 200) throw new Error('Unexpected response from the server: HTTP ' + code + '.');
  var body = JSON.parse(res.getContentText());
  if (!body || !Array.isArray(body.lines)) throw new Error('The server answer did not look like order data.');
  return body;
}

/* -------------------------------- sheets --------------------------------- */

function linesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_LINES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LINES);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('C:C').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return sheet;
}

function ensureSummaries_() {
  var ss = SpreadsheetApp.getActive();
  var range = "'" + SHEET_LINES + "'!A2:T";

  if (!ss.getSheetByName(SHEET_STORES)) {
    var s = ss.insertSheet(SHEET_STORES);
    s.getRange('A1').setFormula(
      '=QUERY(' + range + ',"select D, sum(Q), sum(P), sum(R), sum(S) where D <> \'\' and ' + NOT_SALE +
      ' group by D order by sum(R) desc label D \'Store\', sum(Q) \'Orders\', sum(P) \'Items sold\', ' +
      'sum(R) \'Revenue\', sum(S) \'Tax\'",0)'
    );
    s.setFrozenRows(1);
  }

  if (!ss.getSheetByName(SHEET_ITEMS)) {
    var i = ss.insertSheet(SHEET_ITEMS);
    i.getRange('A1').setFormula(
      '=QUERY(' + range + ',"select D, H, sum(P), sum(T) where H <> \'\' and ' + NOT_SALE +
      ' group by D, H order by D, sum(T) desc label D \'Store\', H \'Item\', sum(P) \'Net qty\', ' +
      'sum(T) \'Net revenue\'",0)'
    );
    i.setFrozenRows(1);
  }
}

/** Replace the changed orders' rows in "Order Lines" in a single write. */
function writeChanges_(changed) {
  var sheet = linesSheet_();
  var width = HEADERS.length;
  var lastRow = sheet.getLastRow();
  var existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
  var merged = mergeRows_(existing, changed);

  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, width).clearContent();
  if (merged.length === 0) return 0;

  var needRows = merged.length + 1;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows());
  sheet.getRange(2, 1, merged.length, width).setValues(merged);
  return merged.length;
}

/* ------------------------------- the sync -------------------------------- */

/** Pull new and changed orders. Safe to run repeatedly; the timer calls this. */
function syncNow() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    say_('Another sync is running. Skipped.');
    return;
  }
  try {
    run_();
  } catch (e) {
    say_('Sync failed: ' + e.message);
    throw e; // shows in the Apps Script execution log and failure emails
  } finally {
    lock.releaseLock();
  }
}

function run_() {
  var cfg = config_();
  if (!cfg) {
    say_('Not connected. Use OBIX360 Sync > 1. Connect.');
    return;
  }
  var p = props_();
  var cursor = p.getProperty('CURSOR') || '';
  var changed = {};
  var orders = 0;
  var started = Date.now();
  var hasMore = true;

  while (hasMore && Date.now() - started < TIME_BUDGET_MS) {
    var batch = fetchBatch_(cfg, cursor, BATCH_LIMIT);
    var byOrder = groupBatch_(batch.lines);
    Object.keys(byOrder).forEach(function (id) { changed[id] = byOrder[id]; }); // a newer copy wins
    orders += batch.order_ids ? batch.order_ids.length : 0;
    cursor = batch.next_cursor || cursor;
    hasMore = !!batch.has_more;
  }

  linesSheet_();
  ensureSummaries_();
  var total = Object.keys(changed).length ? writeChanges_(changed) : null;

  // Move the position forward only after the sheet was written successfully.
  p.setProperty('CURSOR', cursor);
  p.setProperty('LAST_SYNC', new Date().toISOString());

  say_(
    'Synced ' + orders + ' order(s)' + (total === null ? '' : ', ' + total + ' line row(s) in the sheet') +
    (hasMore ? '. More history remains; it continues on the next run.' : '. Up to date.')
  );
}

/* --------------------------------- menu ---------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OBIX360 Sync')
    .addItem('1. Connect', 'connect')
    .addItem('Sync now', 'syncNow')
    .addItem('2. Start auto-sync (every 10 min)', 'startAutoSync')
    .addItem('Stop auto-sync', 'stopAutoSync')
    .addSeparator()
    .addItem('Full resync (rebuild from scratch)', 'fullResync')
    .addItem('Status', 'showStatus')
    .addToUi();
}

function connect() {
  var ui = SpreadsheetApp.getUi();
  var u = ui.prompt('Connect to OBIX360', 'Server address, e.g. https://obix360.com', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  var base = u.getResponseText().trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/.test(base)) {
    alert_('Enter the address starting with https:// and without a path, for example https://obix360.com');
    return;
  }
  var k = ui.prompt('Sync key', 'Paste the SHEETS_SYNC_KEY value from the server.', ui.ButtonSet.OK_CANCEL);
  if (k.getSelectedButton() !== ui.Button.OK) return;
  var key = k.getResponseText().trim();
  if (key.length < 24) {
    alert_('The key must be at least 24 characters.');
    return;
  }

  try {
    fetchBatch_({ base: base, key: key }, '', 1); // test the connection before saving
  } catch (e) {
    alert_('Could not connect: ' + e.message);
    return;
  }
  var p = props_();
  p.setProperty('BASE_URL', base);
  p.setProperty('KEY', key);
  p.deleteProperty('CURSOR'); // new connection starts from the beginning
  linesSheet_();
  ensureSummaries_();
  alert_('Connected. Now run "Sync now", then "2. Start auto-sync".');
}

function startAutoSync() {
  stopAutoSync_();
  ScriptApp.newTrigger(TRIGGER_FUNCTION).timeBased().everyMinutes(10).create();
  alert_('Auto-sync is on. The sheet refreshes about every 10 minutes.');
}

function stopAutoSync() {
  stopAutoSync_();
  alert_('Auto-sync is off.');
}

function stopAutoSync_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FUNCTION) ScriptApp.deleteTrigger(t);
  });
}

function fullResync() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert(
    'Full resync',
    'This clears the Order Lines tab and loads everything again. The summary tabs update by themselves. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (ok !== ui.Button.YES) return;
  var sheet = linesSheet_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).clearContent();
  props_().deleteProperty('CURSOR');
  syncNow();
}

function showStatus() {
  var p = props_();
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === TRIGGER_FUNCTION;
  }).length;
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_LINES);
  alert_(
    'Server: ' + (p.getProperty('BASE_URL') || 'not connected') +
    '\nLast sync: ' + (p.getProperty('LAST_SYNC') || 'never') +
    '\nAuto-sync: ' + (triggers ? 'on' : 'off') +
    '\nRows in Order Lines: ' + (sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0)
  );
}
