/**
 * «Дом · Мария и Марат» — сервер для приложения и виджетов.
 * Живёт внутри Google Таблицы «Маша». Хранит задачи, дела, меню, покупки и траты
 * в обычных вкладках таблицы, отдаёт доходы (ДОХОДЫ) и план (РАСХОДЫ в месяц).
 *
 * Установка — см. README: вставить код, запустить setup(), развернуть как веб-приложение.
 */

const TZ = 'Asia/Tbilisi';
const WHO = { maria: 'Мария', marat: 'Марат', both: 'Вместе' };
const WHO_R = { 'мария': 'maria', 'маша': 'maria', 'марат': 'marat', 'вместе': 'both' };
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const CAT_NAMES = { common: 'Жильё и связь', health: 'Здоровье', hobby: 'Хобби', subs: 'Подписки', transport: 'Транспорт',
  shopping: 'Онлайн шоппинг', groceries: 'Продукты и быт', cafe: 'Развлечения', other: 'Прочее' };
const CAT_FROM_NAME = (() => { const m = {}; Object.keys(CAT_NAMES).forEach(k => m[CAT_NAMES[k].toLowerCase()] = k);
  m['общие'] = 'common'; m['онлайн шопинг'] = 'shopping'; m['онлайн-шопинг'] = 'shopping'; return m; })();
const LEGACY_CAT = { housing: 'common', utilities: 'common', beauty: 'other' };

/* ---------- helpers ---------- */
const yes = v => /^(да|yes|true|1|✓|x)$/i.test(String(v).trim());
const iso2ru = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || ''); };
const ru2iso = s => { s = String(s || '').trim(); let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) return `${m[3]}-${('0' + m[2]).slice(-2)}-${('0' + m[1]).slice(-2)}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
const num = v => { const t = String(v ?? '').replace(/[\s $₾]/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'); const n = parseFloat(t); return isFinite(n) ? n : 0; };
const today = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

/* ---------- collections: how app objects map to sheet rows ---------- */
const COLS = {
  tasks: { sheet: 'Задачи', idCol: 0, width: 7,
    to: o => [o.id, o.title || '', WHO[o.who] || 'Вместе', iso2ru(o.date), o.scope === 'week' ? 'да' : '', o.done ? 'да' : '', o.ts || ''],
    from: r => ({ id: r[0], title: r[1], who: WHO_R[String(r[2]).toLowerCase()] || 'both', date: ru2iso(r[3]) || today(), scope: yes(r[4]) ? 'week' : 'day', done: yes(r[5]), ts: num(r[6]) }) },
  chores: { sheet: 'Дела по дому', idCol: 0, width: 8,
    to: o => [o.id, o.title || '', WHO[o.who] || 'Вместе', o.freq === 'daily' ? 'каждый день' : 'раз в неделю', o.freq === 'daily' ? '' : WD[o.weekday || 0], iso2ru(o.last), iso2ru(o.prev), o.ts || ''],
    from: r => ({ id: r[0], title: r[1], who: WHO_R[String(r[2]).toLowerCase()] || 'both', freq: /кажд/i.test(r[3]) ? 'daily' : 'weekly', weekday: Math.max(0, WD.indexOf(String(r[4]).trim())), last: ru2iso(r[5]) || null, prev: ru2iso(r[6]) || null, ts: num(r[7]) }) },
  menu: { sheet: 'Меню', idCol: 0, width: 4, idOf: r => ru2iso(r[0]),
    to: o => [iso2ru(o.id || o.date), o.lunch || '', o.dinner || '', o.ingr || ''],
    from: r => ({ id: ru2iso(r[0]), date: ru2iso(r[0]), lunch: r[1], dinner: r[2], ingr: r[3] }) },
  shop: { sheet: 'Покупки', idCol: 0, width: 6,
    to: o => [o.id, o.name || '', o.done ? 'да' : '', WHO[o.by] || '', o.src || '', o.ts || ''],
    from: r => ({ id: r[0], name: r[1], done: yes(r[2]), by: WHO_R[String(r[3]).toLowerCase()] || null, src: r[4], ts: num(r[5]) }) },
  tx: { sheet: 'РАСХОДЫ журнал', idCol: 10, width: 12,
    to: o => { const cat = LEGACY_CAT[o.cat] || o.cat; return [iso2ru(o.date), String(o.date || '').slice(0, 7), CAT_NAMES[cat] || 'Прочее', o.note || '',
      Number(o.amount) || 0, o.cur === 'USD' ? '$' : '₾', o.cur === 'USD' ? '' : (Number(o.rate) || ''), Math.round((Number(o.usd) || 0) * 100) / 100,
      WHO[o.who] || 'Вместе', o.source === 'bank' ? 'выписка банка' : 'приложение', o.id, o.planItem || (o.fixed ? 'да' : '')]; },
    from: r => { const p = String(r[11] || '').trim(); const date = ru2iso(r[0]); const cur = String(r[5]).indexOf('$') >= 0 ? 'USD' : 'GEL';
      return { id: r[10], type: 'expense', date, cat: CAT_FROM_NAME[String(r[2]).trim().toLowerCase()] || 'other', note: r[3], amount: num(r[4]), cur,
        rate: cur === 'GEL' ? num(r[6]) || null : null, usd: num(r[7]), who: WHO_R[String(r[8]).toLowerCase()] || 'both',
        source: /банк/i.test(r[9]) ? 'bank' : 'app', planItem: p && !yes(p) ? p : '', fixed: !!p }; } }
};

function sheetOf(c) {
  const sh = SpreadsheetApp.getActive().getSheetByName(COLS[c].sheet);
  if (!sh) throw new Error('Нет вкладки «' + COLS[c].sheet + '»');
  return sh;
}
function readCol(c) {
  const def = COLS[c], sh = sheetOf(c), last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, def.width).getDisplayValues();
  return vals.filter(r => (def.idOf ? def.idOf(r) : r[def.idCol])).map(def.from);
}
function findRow(c, id) {
  const def = COLS[c], sh = sheetOf(c), last = sh.getLastRow();
  if (last < 2) return -1;
  const vals = sh.getRange(2, 1, last - 1, def.width).getDisplayValues();
  for (let i = 0; i < vals.length; i++) { const rid = def.idOf ? def.idOf(vals[i]) : String(vals[i][def.idCol]); if (rid === String(id)) return i + 2; }
  return -1;
}
function applyOp(op) {
  const def = COLS[op.col]; if (!def) throw new Error('bad collection ' + op.col);
  if (!op.id) throw new Error('no id');
  const sh = sheetOf(op.col), row = findRow(op.col, op.id);
  if (op.data === null) { if (row > 0) sh.getRange(row, 1, 1, def.width).deleteCells(SpreadsheetApp.Dimension.ROWS); return; }
  const values = def.to(Object.assign({}, op.data, { id: op.id }));
  const target = row > 0 ? row : Math.max(sh.getLastRow(), 1) + 1;
  const rng = sh.getRange(target, 1, 1, values.length);
  rng.setNumberFormats([values.map(v => typeof v === 'number' ? '0.##' : '@')]);
  rng.setValues([values]);
}

/* ---------- finance helpers ---------- */
function rate() {
  const p = PropertiesService.getScriptProperties();
  return { usdGel: Number(p.getProperty('RATE')) || 0, date: p.getProperty('RATE_DATE') || '' };
}
function updateRate() {
  try {
    const res = UrlFetchApp.fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD', { muteHttpExceptions: true });
    const j = JSON.parse(res.getContentText());
    const c = j[0].currencies.find(x => x.code === 'USD');
    const r = Number(c.rate) / (Number(c.quantity) || 1);
    if (r > 0) {
      const p = PropertiesService.getScriptProperties();
      p.setProperty('RATE', String(Math.round(r * 10000) / 10000));
      p.setProperty('RATE_DATE', String(c.validFromDate || j[0].date || '').slice(0, 10));
    }
  } catch (e) { console.warn('rate update failed', e); }
}
function planValues() { const sh = SpreadsheetApp.getActive().getSheetByName('РАСХОДЫ в месяц'); return sh ? sh.getRange('A1:F200').getDisplayValues() : []; }
function incomeValues() { const sh = SpreadsheetApp.getActive().getSheetByName('ДОХОДЫ'); return sh ? sh.getRange('A1:K1000').getDisplayValues() : []; }
function parsePlan(values) {
  const items = []; let started = false, cat = '', limUsd = 0, limGel = 0;
  for (const r of values) {
    if (!started) { if (/статья/i.test(r[0])) started = true; continue; }
    if (/^сумма$/i.test(String(r[0]).trim())) break;
    if (!r[1] && !r[3] && !r[4]) continue;
    if (r[0]) cat = r[0];
    const u = num(r[3]), g = num(r[4]); limUsd += u; limGel += g;
    const d = String(r[2]).match(/(\d{1,2})/);
    items.push({ name: String(r[1]).trim(), usd: u, gel: g, day: d ? +d[1] : null });
  }
  return { items, limUsd, limGel };
}

/* ---------- API ---------- */
function all() {
  return { ok: true, serverTime: new Date().toISOString(), today: today(), rate: rate(),
    tasks: readCol('tasks'), chores: readCol('chores'), menu: readCol('menu'), shop: readCol('shop'), tx: readCol('tx'),
    income: incomeValues(), plan: planValues(), sheetUrl: SpreadsheetApp.getActive().getUrl(),
    incomeGid: (SpreadsheetApp.getActive().getSheetByName('ДОХОДЫ') || { getSheetId: () => '' }).getSheetId(),
    planGid: (SpreadsheetApp.getActive().getSheetByName('РАСХОДЫ в месяц') || { getSheetId: () => '' }).getSheetId() };
}

function summary(who) {
  const t = today(), r = rate().usdGel, M = t.slice(0, 7);
  const d = new Date(t + 'T12:00:00'), wd = (d.getDay() + 6) % 7, mon = new Date(d); mon.setDate(d.getDate() - wd);
  const monIso = Utilities.formatDate(mon, TZ, 'yyyy-MM-dd');
  const vis = x => !who || who === 'all' || x.who === who || x.who === 'both';
  const tasks = readCol('tasks').filter(x => vis(x) && !x.done && ((x.scope !== 'week' && x.date <= t) || (x.scope === 'week' && x.date >= monIso && x.date <= t)));
  const chores = readCol('chores').filter(c => { if (!vis(c)) return false; const done = c.freq === 'daily' ? c.last === t : (c.last && c.last >= monIso); return !done && (c.freq === 'daily' || wd >= c.weekday); });
  const menu = readCol('menu').find(m => m.id === t) || {};
  const shop = readCol('shop').filter(s => !s.done);
  const tx = readCol('tx').filter(x => x.date.slice(0, 7) === M);
  const spent = tx.reduce((a, x) => a + x.usd, 0);
  const plan = parsePlan(planValues());
  const planUsd = plan.limUsd + (r ? plan.limGel / r : 0);
  const used = new Set();
  const due = plan.items.filter(i => i.day).filter(i => { const hit = tx.find(x => !used.has(x.id) && x.planItem === i.name); if (hit) { used.add(hit.id); return false; } return true; })
    .sort((a, b) => ((a.day - d.getDate() + 31) % 31) - ((b.day - d.getDate() + 31) % 31));
  const next = due[0];
  return { ok: true, date: t, tasksCount: tasks.length + chores.length,
    tasks: tasks.map(x => x.title).concat(chores.map(c => c.title)).slice(0, 5),
    dinner: menu.dinner || '', lunch: menu.lunch || '', shopCount: shop.length,
    budgetLeftUsd: Math.round(planUsd - spent), spentUsd: Math.round(spent), planUsd: Math.round(planUsd),
    nextPayment: next ? { name: next.name, day: next.day, amount: next.usd ? '$' + next.usd : next.gel + ' ₾' } : null,
    rate: r };
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function checkPin(pin) { const p = PropertiesService.getScriptProperties().getProperty('PIN'); return p && String(pin) === p; }

function doGet(e) {
  const q = e.parameter || {};
  if (q.action === 'summary') {
    const key = PropertiesService.getScriptProperties().getProperty('WIDGET_KEY');
    if (!key || q.key !== key) return json({ ok: false, error: 'bad_key' });
    return json(summary(q.who));
  }
  return json({ ok: true, app: 'dom', hint: 'POST only' });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) { return json({ ok: false, error: 'bad_json' }); }
  if (!checkPin(body.pin)) return json({ ok: false, error: 'bad_pin' });
  try {
    if (body.action === 'all') return json(all());
    if (body.action === 'write') {
      const lock = LockService.getScriptLock(); lock.waitLock(20000);
      try { (body.ops || []).forEach(applyOp); } finally { lock.releaseLock(); }
      return json({ ok: true });
    }
    if (body.action === 'summary') return json(summary(body.who));
    return json({ ok: false, error: 'bad_action' });
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
}

/* ---------- one-time setup: run this once from the editor ---------- */
function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('PIN')) p.setProperty('PIN', String(Math.floor(100000 + Math.random() * 900000)));
  if (!p.getProperty('WIDGET_KEY')) p.setProperty('WIDGET_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  updateRate();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'updateRate').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('updateRate').timeBased().everyDays(1).atHour(7).inTimezone(TZ).create();
  ScriptApp.newTrigger('updateRate').timeBased().everyDays(1).atHour(18).inTimezone(TZ).create();
  const r = rate();
  console.log('ПИН для приложения: ' + p.getProperty('PIN'));
  console.log('Ключ для виджетов: ' + p.getProperty('WIDGET_KEY'));
  console.log('Курс НБГ: ' + r.usdGel + ' на ' + r.date);
}
