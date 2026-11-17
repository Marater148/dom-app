// Виджет «Дом» для iPhone (приложение Scriptable).
// 1) Вставьте ссылку веб-приложения и ключ виджета ниже.
// 2) WHO: "maria" — задачи Маши и общие, "marat" — Марата и общие, "all" — все.
const URL_EXEC = "ВСТАВЬТЕ_ССЫЛКУ/exec";
const WIDGET_KEY = "ВСТАВЬТЕ_КЛЮЧ_ВИДЖЕТА";
const WHO = "maria";
const APP_URL = "ВСТАВЬТЕ_АДРЕС_ПРИЛОЖЕНИЯ"; // например https://dom-maria-marat.vercel.app

const C = { bg: new Color("#121418"), card: new Color("#1B1E23"), text: new Color("#ECEAE4"), muted: new Color("#8C9099"),
  lav: new Color("#B5A8E8"), good: new Color("#A8D5A2"), bad: new Color("#E89090"), peach: new Color("#F2B880") };

async function load() {
  const fm = FileManager.local(), cache = fm.joinPath(fm.cacheDirectory(), "dom-widget.json");
  try {
    const r = new Request(`${URL_EXEC}?action=summary&key=${encodeURIComponent(WIDGET_KEY)}&who=${WHO}`);
    r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (!j.ok) throw new Error(j.error);
    fm.writeString(cache, JSON.stringify(j));
    return j;
  } catch (e) {
    if (fm.fileExists(cache)) { const j = JSON.parse(fm.readString(cache)); j.stale = true; return j; }
    return { ok: false, error: String(e) };
  }
}

function t(stack, text, size, color, weight) {
  const x = stack.addText(text); x.font = weight === "b" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  x.textColor = color || C.text; x.lineLimit = 1; return x;
}

async function build(d) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(14, 14, 14, 14);
  if (APP_URL.startsWith("http")) w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
  if (!d.ok) { t(w, "Дом", 13, C.lav, "b"); w.addSpacer(6); t(w, "Нет связи с таблицей", 12, C.muted); return w; }
  const fam = config.widgetFamily || "medium";
  const head = w.addStack(); head.centerAlignContent();
  t(head, "Дом", 13, C.lav, "b"); head.addSpacer();
  t(head, d.stale ? "кэш" : new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), 10, C.muted);
  w.addSpacer(8);
  const left = d.budgetLeftUsd;
  t(w, "До лимита месяца", 11, C.muted);
  t(w, (left < 0 ? "−$" : "$") + Math.abs(left).toLocaleString("ru-RU"), fam === "small" ? 24 : 26, left < 0 ? C.bad : C.good, "b");
  w.addSpacer(6);
  t(w, `Задач сегодня: ${d.tasksCount}` + (d.shopCount ? ` · купить: ${d.shopCount}` : ""), 12, C.text);
  if (fam !== "small") {
    w.addSpacer(4);
    if (d.dinner) t(w, "Ужин: " + d.dinner, 12, C.text);
    if (d.nextPayment) t(w, `Платёж ${d.nextPayment.day}-го: ${d.nextPayment.name} · ${d.nextPayment.amount}`, 11, C.peach);
    if (fam === "large") { w.addSpacer(8); d.tasks.forEach(x => t(w, "• " + x, 12, C.text)); }
  }
  w.addSpacer();
  return w;
}

const data = await load();
const widget = await build(data);
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
