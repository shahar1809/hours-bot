// Channel-independent message handling: log an entry, show a report, delete the last entry.
import crypto from 'node:crypto';
import { parseEntry, clean, ilDate, monthKey, prevMonthKey } from './parse.mjs';
import { buildReport, fmtHM, fmtDay, totalMinutes } from './report.mjs';
import { getEntries, saveEntries, getState, saveState } from './store.mjs';

export const HELP = `רישום שעות:
• לבצלר 4 שעות
• לאורו נלך 14:00 עד 16:00
אפשר להוסיף יום: "אתמול", "שלשום" או "3/11".

פקודות:
• דוח — דוח החודש עד עכשיו
• דוח קודם — דוח החודש שעבר
• מחק — מוחק את הרישום האחרון`;

/** Returns the reply text for one incoming message from `user`. */
export async function handleText(user, text) {
  const norm = clean(text);
  const today = ilDate(0);
  const thisMonth = monthKey(today);

  if (/^(עזרה|help|\?)$/i.test(norm)) return HELP;

  const rep = norm.match(/^(?:דוח|דו"ח|דו״ח|report)(?:\s+(.+))?$/i);
  if (rep) {
    const arg = rep[1] ?? '';
    const mk = /^(קודם|חודש קודם|שעבר|חודש שעבר|last|prev)$/i.test(arg) ? prevMonthKey(thisMonth) : thisMonth;
    return buildReport(mk, await getEntries(user, mk));
  }

  if (/^(מחק|בטל|undo)(\s+אחרון)?$/i.test(norm)) {
    const state = await getState(user);
    if (!state.last) return 'אין רישום למחיקה.';
    const { month, id } = state.last;
    const entries = await getEntries(user, month);
    const gone = entries.find((e) => e.id === id);
    if (!gone) return 'הרישום האחרון כבר נמחק.';
    await saveEntries(user, month, entries.filter((e) => e.id !== id));
    delete state.last;
    await saveState(user, state);
    return `נמחק: ${fmtDay(gone.date)} · ${gone.place} · ${fmtHM(gone.minutes)}`;
  }

  const parsed = parseEntry(text);
  if (parsed.error) return parsed.error;

  const mk = monthKey(parsed.date);
  const entries = await getEntries(user, mk);
  const entry = {
    id: crypto.randomUUID(),
    date: parsed.date,
    place: parsed.place,
    minutes: parsed.minutes,
    ts: Date.now(),
  };
  entries.push(entry);
  await saveEntries(user, mk, entries);
  const state = await getState(user);
  state.last = { month: mk, id: entry.id };
  await saveState(user, state);

  return `נרשם ✅\n${fmtDay(entry.date)} · ${entry.place} · ${fmtHM(entry.minutes)}\nסה״כ החודש: ${fmtHM(totalMinutes(entries))}`;
}
