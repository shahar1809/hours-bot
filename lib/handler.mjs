// Channel-independent message handling: log an entry, show a report, delete the last entry.
import crypto from 'node:crypto';
import { parseEntry, clean, ilDate, monthKey, prevMonthKey } from './parse.mjs';
import { buildReport, fmtHM, fmtDay, totalMinutes, monthTitle, sortEntries } from './report.mjs';
import { getEntries, saveEntries, getState, saveState } from './store.mjs';

export const HELP = `רישום שעות:
• לבצלר 4 שעות
• לאורו נלך 14:00 עד 16:00
אפשר להוסיף יום: "אתמול", "שלשום" או "3/11".

פקודות:
• דוח — דוח החודש עד עכשיו
• דוח קודם — דוח החודש שעבר
• רשימה — רשימה ממוספרת של רישומי החודש
• מחק 3 — מוחק את רישום מספר 3 מהרשימה האחרונה שנשלחה
• מחק — מוחק את הרישום האחרון
• נקה חודש — מוחק את כל רישומי החודש (יש לאשר)`;

/** Returns the reply text for one incoming message from `user`. */
export async function handleText(user, text) {
  const norm = clean(text);
  const today = ilDate(0);
  const thisMonth = monthKey(today);

  const state = await getState(user);
  const pending = state.pendingClear;
  if (pending) {
    delete state.pendingClear; // any message other than the confirmation cancels the pending clear
    if (/^(אישור|אשר|confirm)$/i.test(norm)) {
      if (Date.now() - pending.ts > 5 * 60_000) {
        await saveState(user, state);
        return 'פג תוקף האישור. שלחי "נקה חודש" שוב.';
      }
      const n = (await getEntries(user, pending.month)).length;
      await saveEntries(user, pending.month, []);
      if (state.last?.month === pending.month) delete state.last;
      if (state.listing?.month === pending.month) delete state.listing;
      await saveState(user, state);
      return `נמחקו ${n} רישומים של ${monthTitle(pending.month)}.`;
    }
    await saveState(user, state);
  }

  if (/^(עזרה|help|\?)$/i.test(norm)) return HELP;

  const list = norm.match(/^(?:רשימה|list)(?:\s+(.+))?$/i);
  if (list) {
    const mk = /^(קודם|חודש קודם|שעבר|חודש שעבר|last|prev)$/i.test(list[1] ?? '') ? prevMonthKey(thisMonth) : thisMonth;
    const sorted = sortEntries(await getEntries(user, mk));
    state.listing = { month: mk, ids: sorted.map((e) => e.id) };
    await saveState(user, state);
    if (!sorted.length) return `אין רישומים לחודש ${monthTitle(mk)}.`;
    const lines = sorted.map((e, i) => `${i + 1}. ${fmtDay(e.date)} · ${e.place} · ${fmtHM(e.minutes)}`);
    return `רישומי ${monthTitle(mk)}:\n${lines.join('\n')}\n\nלמחיקה: "מחק 3"`;
  }

  if (/^(נקה|מחק)\s+(חודש|הכל|הכול)(\s+(קודם|שעבר))?$/i.test(norm)) {
    const prev = /(קודם|שעבר)$/.test(norm);
    const mk = prev ? prevMonthKey(thisMonth) : thisMonth;
    const n = (await getEntries(user, mk)).length;
    if (!n) return `אין רישומים לחודש ${monthTitle(mk)}.`;
    state.pendingClear = { month: mk, ts: Date.now() };
    await saveState(user, state);
    return `⚠️ למחוק את כל ${n} הרישומים של ${monthTitle(mk)}? אי אפשר לשחזר.\nלאישור שלחי: אישור\n(כל הודעה אחרת מבטלת)`;
  }

  const del = norm.match(/^(?:מחק|בטל|delete)\s+(?:רישום\s+)?(?:מספר\s+)?#?(\d+)$/i);
  if (del) {
    const idx = +del[1];
    const l = state.listing;
    if (!l) return 'שלחי קודם "רשימה" כדי לראות את המספרים, ואז "מחק 3".';
    const id = l.ids[idx - 1];
    if (!id) return `אין רישום מספר ${idx}. שלחי "רשימה" לראות את המספרים.`;
    const entries = await getEntries(user, l.month);
    const gone = entries.find((e) => e.id === id);
    if (!gone) return `רישום ${idx} כבר נמחק. שלחי "רשימה" לרשימה מעודכנת.`;
    await saveEntries(user, l.month, entries.filter((e) => e.id !== id));
    if (state.last?.id === id) delete state.last;
    // the numbering has shifted, so the old list is no longer valid
    delete state.listing;
    await saveState(user, state);
    const left = entries.length - 1;
    return `נמחק: ${fmtDay(gone.date)} · ${gone.place} · ${fmtHM(gone.minutes)}\nנשארו ${left} רישומים. שלחי "רשימה" לרשימה מעודכנת.`;
  }

  const rep = norm.match(/^(?:דוח|דו"ח|דו״ח|report)(?:\s+(.+))?$/i);
  if (rep) {
    const arg = rep[1] ?? '';
    const mk = /^(קודם|חודש קודם|שעבר|חודש שעבר|last|prev)$/i.test(arg) ? prevMonthKey(thisMonth) : thisMonth;
    return buildReport(mk, await getEntries(user, mk));
  }

  if (/^(מחק|בטל|undo)(\s+אחרון)?$/i.test(norm)) {
    if (!state.last) return 'אין רישום למחיקה.';
    const { month, id } = state.last;
    const entries = await getEntries(user, month);
    const gone = entries.find((e) => e.id === id);
    if (!gone) return 'הרישום האחרון כבר נמחק.';
    await saveEntries(user, month, entries.filter((e) => e.id !== id));
    delete state.last;
    delete state.listing;
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
  state.last = { month: mk, id: entry.id };
  delete state.listing; // numbering changes once an entry is added
  await saveState(user, state);

  return `נרשם ✅\n${fmtDay(entry.date)} · ${entry.place} · ${fmtHM(entry.minutes)}\nסה״כ החודש: ${fmtHM(totalMinutes(entries))}`;
}
