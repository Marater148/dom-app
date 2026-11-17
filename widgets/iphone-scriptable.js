// Виджет «Дом» для iPhone — приложение Scriptable.
// Вставьте ключ виджета в WIDGET_KEY (Apps Script → ⚙ Настройки проекта → Свойства скрипта → WIDGET_KEY).
// WHO: "maria" — задачи Маши и общие, "marat" — Марата и общие, "all" — все.
const URL_EXEC = "ВСТАВЬТЕ_ССЫЛКУ/exec";
const WIDGET_KEY = "ВСТАВЬТЕ_КЛЮЧ_ВИДЖЕТА";
const WHO = "maria";
const APP_URL = "https://marater148.github.io/dom-app/";
const PHOTOS = 22;          // сколько фото в фоне приложения
const USE_PHOTO = true;     // false — однотонный тёмный фон

const C = { bg: new Color("#121418"), text: new Color("#ECEAE4"), muted: new Color("#B4B8C0"),
  lav: new Color("#B5A8E8"), good: new Color("#A8D5A2"), bad: new Color("#E89090"), peach: new Color("#F2B880") };
const fm = FileManager.local();
const cachePath = n => fm.joinPath(fm.cacheDirectory(), n);

async function load() {
  const cache = cachePath("dom-widget.json");
  try {
    const r = new Request(`${URL_EXEC}?action=summary&key=${encodeURIComponent(WIDGET_KEY)}&who=${WHO}`);
    r.timeoutInterval = 20;
    const j = await r.loadJSON();
    if (!j.ok) throw new Error(j.error || "ошибка");
    fm.writeString(cache, JSON.stringify(j));
    return j;
  } catch (e) {
    if (fm.fileExists(cache)) { const j = JSON.parse(fm.readString(cache)); j.stale = true; return j; }
    return { ok: false, error: String(e.message || e) };
  }
}

// Случайное фото из приложения + тёмная вуаль, чтобы текст читался.
async function photoBg(fam) {
  const i = 1 + Math.floor(Math.random() * PHOTOS), n = (i < 10 ? "0" : "") + i;
  const p = cachePath(`dom-bg-${n}.jpg`);
  let img;
  try {
    if (fm.fileExists(p)) img = fm.readImage(p);
    else { img = await new Request(`${APP_URL}bg/${n}.webp`).loadImage(); fm.writeImage(p, img); }
  } catch (e) { return null; }
  const W = fam === "small" ? 340 : 720, H = fam === "large" ? 760 : 340;
  const s = Math.max(W / img.size.width, H / img.size.height);
  const w = img.size.width * s, h = img.size.height * s;
  const ctx = new DrawContext(); ctx.size = new Size(W, H); ctx.opaque = true; ctx.respectScreenScale = false;
  ctx.drawImageInRect(img, new Rect((W - w) / 2, (H - h) / 2, w, h));
  ctx.setFillColor(new Color("#0E1014", 0.62)); ctx.fillRect(new Rect(0, 0, W, H));
  return ctx.getImage();
}

function t(stack, text, size, color, bold) {
  const x = stack.addText(String(text)); x.font = bold ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  x.textColor = color || C.text; x.lineLimit = 1; x.minimumScaleFactor = 0.7;
  x.shadowColor = new Color("#000000", 0.5); x.shadowRadius = 2; return x;
}
const money = v => (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("ru-RU");

async function build(d) {
  const fam = config.widgetFamily || "medium";
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(14, 15, 14, 15);
  w.url = APP_URL; w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (USE_PHOTO) { const bg = await photoBg(fam); if (bg) w.backgroundImage = bg; }

  if (!d.ok) {
    t(w, "Дом", 13, C.lav, true); w.addSpacer(6);
    t(w, WIDGET_KEY.startsWith("ВСТАВЬТЕ") ? "Вставьте ключ виджета" : "Нет связи с таблицей", 12, C.muted);
    return w;
  }
  const head = w.addStack(); head.centerAlignContent();
  t(head, "Дом", 13, C.lav, true); head.addSpacer();
  t(head, d.stale ? "нет сети" : new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), 10, C.muted);
  w.addSpacer(fam === "small" ? 6 : 8);

  t(w, "Осталось в месяце", 11, C.muted);
  t(w, money(d.budgetLeftUsd), fam === "small" ? 24 : 28, d.budgetLeftUsd < 0 ? C.bad : C.good, true);
  w.addSpacer(6);
  t(w, `Задач: ${d.tasksCount}` + (d.shopCount ? ` · купить: ${d.shopCount}` : ""), 12);
  if (fam !== "small") {
    if (d.dinner) { w.addSpacer(3); t(w, "Ужин: " + d.dinner, 12); }
    if (d.nextPayment) { w.addSpacer(3); t(w, `${d.nextPayment.day}-го: ${d.nextPayment.name} · ${d.nextPayment.amount}`, 11, C.peach); }
  }
  if (fam === "large" && d.tasks && d.tasks.length) {
    w.addSpacer(10); t(w, "СЕГОДНЯ", 10, C.muted, true); w.addSpacer(4);
    d.tasks.forEach(x => { t(w, "•  " + x, 13); w.addSpacer(3); });
  }
  w.addSpacer();
  return w;
}

const data = await load();
const widget = await build(data);
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
