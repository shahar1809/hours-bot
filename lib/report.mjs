// Formatting helpers and the monthly report text.

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** Hours as a decimal: 90 -> "1.5", 240 -> "4". */
export const fmtHM = (min) => String(Math.round((min / 60) * 100) / 100);
export const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function monthTitle(mk) {
  const [y, m] = mk.split('-');
  return `${MONTHS[+m - 1]} ${y}`;
}

export function totalMinutes(entries) {
  return entries.reduce((s, e) => s + e.minutes, 0);
}

export const sortEntries = (entries) => [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);

export function buildReport(mk, entries) {
  if (!entries.length) return `אין רישומים לחודש ${monthTitle(mk)}.`;

  const sorted = sortEntries(entries);

  const byPlace = new Map();
  for (const e of sorted) {
    if (!byPlace.has(e.place)) byPlace.set(e.place, []);
    byPlace.get(e.place).push(e);
  }
  const places = [...byPlace.entries()].sort((x, y) => totalMinutes(y[1]) - totalMinutes(x[1]));

  const total = totalMinutes(sorted);
  const lines = [`📊 דוח שעות — ${monthTitle(mk)}`];
  for (const [p, es] of places) {
    lines.push('', `${p}:`);
    for (const e of es) lines.push(`${fmtDay(e.date)} ${fmtHM(e.minutes)}`);
  }
  lines.push('', 'סיכום:');
  for (const [p, es] of places) lines.push(`${p}: ${fmtHM(totalMinutes(es))}`);
  lines.push(`סה״כ: ${fmtHM(total)} שעות`);
  return lines.join('\n');
}

/** WhatsApp text messages are capped at 4096 chars; split on line boundaries. */
export function splitMessage(text, max = 3800) {
  if (text.length <= max) return [text];
  const out = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > max && cur) { out.push(cur); cur = line; }
    else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) out.push(cur);
  return out;
}
