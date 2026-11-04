// Formatting helpers and the monthly report text.

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const fmtHM = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const fmtDec = (min) => String(Math.round((min / 60) * 100) / 100);
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
  for (const e of sorted) byPlace.set(e.place, (byPlace.get(e.place) ?? 0) + e.minutes);
  const places = [...byPlace.entries()].sort((a, b) => b[1] - a[1]);

  const total = totalMinutes(sorted);
  const lines = [];
  lines.push(`📊 דוח שעות — ${monthTitle(mk)}`);
  lines.push('');
  lines.push('לפי מקום:');
  for (const [p, m] of places) lines.push(`• ${p} — ${fmtHM(m)}`);
  lines.push('');
  lines.push(`סה״כ: ${fmtHM(total)} שעות (${fmtDec(total)})`);
  lines.push('');
  lines.push('פירוט:');
  for (const e of sorted) lines.push(`${fmtDay(e.date)} · ${e.place} · ${fmtHM(e.minutes)}`);
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
