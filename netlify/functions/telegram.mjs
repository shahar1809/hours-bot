// Telegram webhook: one-time setup (GET) and incoming messages (POST).
import crypto from 'node:crypto';
import { handleText, HELP } from '../../lib/handler.mjs';
import { getState, saveState, allowedUsers } from '../../lib/store.mjs';
import { sendText, setWebhook } from '../../lib/tg.mjs';

export const config = { path: '/api/telegram' };

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Telegram slash commands mapped onto the same text commands the handler already knows
const COMMANDS = { '/report': 'דוח', '/prev': 'דוח קודם', '/undo': 'מחק' };

export default async (req) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    // One-time registration: open /api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET> in a browser
    if (secret && safeEqual(url.searchParams.get('setup') ?? '', secret)) {
      const result = await setWebhook(`${url.origin}/api/telegram`, secret);
      return Response.json(result);
    }
    return new Response('ok');
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  if (!secret || !safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) {
    console.error('Rejected: bad or missing secret token. Check TELEGRAM_WEBHOOK_SECRET and re-run setup.');
    return new Response('unauthorized', { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  if (!msg || msg.chat?.type !== 'private') return new Response('ok');

  const userId = String(msg.from.id);
  const chatId = msg.chat.id;
  console.log('message from', userId, 'type', msg.text ? 'text' : 'other');

  if (!allowedUsers().includes(userId)) {
    // Lets the owner see the ID to add to ALLOWED_USER_IDS
    await sendText(chatId, `אין הרשאה. המזהה שלך: ${userId}`);
    return new Response('ok');
  }

  // Telegram retries unacknowledged updates; skip ones we've already handled
  const state = await getState(userId);
  if (update.update_id <= (state.lastUpdateId ?? 0)) return new Response('ok');
  await saveState(userId, { ...state, lastUpdateId: update.update_id });

  let reply;
  if (!msg.text) {
    reply = 'אני מבין רק הודעות טקסט. כתבי "עזרה" לדוגמאות.';
  } else {
    // "/report@MyBot" -> "/report"
    const first = msg.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
    if (first === '/start' || first === '/help') reply = HELP;
    else if (COMMANDS[first]) reply = await handleText(userId, COMMANDS[first]);
    else {
      try { reply = await handleText(userId, msg.text); }
      catch (err) { console.error(err); reply = 'משהו השתבש, נסי שוב.'; }
    }
  }
  await sendText(chatId, reply);
  return new Response('ok');
};
