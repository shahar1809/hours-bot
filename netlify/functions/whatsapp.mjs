// WhatsApp webhook: verification (GET) and incoming messages (POST).
import crypto from 'node:crypto';
import { parseEntry, clean, ilDate, monthKey, prevMonthKey } from '../../lib/parse.mjs';
import { buildReport, fmtHM, fmtDay, totalMinutes } from '../../lib/report.mjs';
import { getEntries, saveEntries, getState, saveState, allowedNumbers } from '../../lib/store.mjs';
import { sendText } from '../../lib/wa.mjs';

export const config = { path: '/api/whatsapp' };

const HELP = `רישום שעות:
• לבצלר 4 שעות
• לאורו נלך 14:00 עד 16:00
אפשר להוסיף יום: "אתמול", "שלשום" או "3/11".

פקודות:
• דוח — דוח החודש עד עכשיו
• דוח קודם — דוח החודש שעבר
• מחק — מוחק את הרישום האחרון`;

function validSignature(rawBody, header) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleText(from, text) {
  const norm = clean(text);
  const today = ilDate(0);
  const thisMonth = monthKey(today);

  if (/^(עזרה|help|\?)$/i.test(norm)) return HELP;

  const rep = norm.match(/^(?:דוח|דו"ח|דו״ח|report)(?:\s+(.+))?$/i);
  if (rep) {
    const arg = rep[1] ?? '';
    const mk = /^(קודם|חודש קודם|שעבר|חודש שעבר|last|prev)$/i.test(arg) ? prevMonthKey(thisMonth) : thisMonth;
    return buildReport(mk, await getEntries(from, mk));
  }

  if (/^(מחק|בטל|undo)(\s+אחרון)?$/i.test(norm)) {
    const state = await getState(from);
    if (!state.last) return 'אין רישום למחיקה.';
    const { month, id } = state.last;
    const entries = await getEntries(from, month);
    const gone = entries.find((e) => e.id === id);
    if (!gone) return 'הרישום האחרון כבר נמחק.';
    await saveEntries(from, month, entries.filter((e) => e.id !== id));
    delete state.last;
    await saveState(from, state);
    return `נמחק: ${fmtDay(gone.date)} · ${gone.place} · ${fmtHM(gone.minutes)}`;
  }

  const parsed = parseEntry(text);
  if (parsed.error) return parsed.error;

  const mk = monthKey(parsed.date);
  const entries = await getEntries(from, mk);
  const entry = { id: crypto.randomUUID(), date: parsed.date, place: parsed.place, minutes: parsed.minutes, ts: Date.now() };
  entries.push(entry);
  await saveEntries(from, mk, entries);
  const state = await getState(from);
  state.last = { month: mk, id: entry.id };
  await saveState(from, state);

  return `נרשם ✅\n${fmtDay(entry.date)} · ${entry.place} · ${fmtHM(entry.minutes)}\nסה״כ החודש: ${fmtHM(totalMinutes(entries))}`;
}

export default async (req) => {
  // Meta's one-time webhook verification
  if (req.method === 'GET') {
    const u = new URL(req.url);
    if (u.searchParams.get('hub.mode') === 'subscribe' &&
        u.searchParams.get('hub.verify_token') === process.env.WA_VERIFY_TOKEN) {
      return new Response(u.searchParams.get('hub.challenge'), { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await req.text();
  console.log('POST received', raw.length, 'bytes');
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) {
    console.error('Rejected: bad signature. Check WA_APP_SECRET.', {
      hasSecret: Boolean(process.env.WA_APP_SECRET),
      hasHeader: Boolean(req.headers.get('x-hub-signature-256')),
    });
    return new Response('bad signature', { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return new Response('ok', { status: 200 }); }

  const allowed = allowedNumbers();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const from = msg.from;
        console.log('message from', from, 'type', msg.type, 'allowed:', allowed.length, 'envs:', {
          token: Boolean(process.env.WA_TOKEN),
          phoneId: Boolean(process.env.WA_PHONE_NUMBER_ID),
        });
        if (!allowed.includes(from)) { console.log('ignored sender', from); continue; }

        // Meta retries on slow responses; skip message ids we've already handled
        const state = await getState(from);
        const seen = state.seen ?? [];
        if (seen.includes(msg.id)) continue;
        await saveState(from, { ...state, seen: [...seen, msg.id].slice(-50), lastInbound: Date.now() });

        let reply;
        if (msg.type === 'text') {
          try { reply = await handleText(from, msg.text.body); }
          catch (err) { console.error(err); reply = 'משהו השתבש, נסי שוב.'; }
        } else {
          reply = 'אני מבין רק הודעות טקסט. כתבי "עזרה" לדוגמאות.';
        }
        await sendText(from, reply);
      }
    }
  }
  return new Response('ok', { status: 200 });
};
