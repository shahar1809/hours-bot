// Telegram Bot API helpers.
import { splitMessage } from './report.mjs';

const api = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

async function call(method, payload) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error(`Telegram ${method} failed`, res.status, JSON.stringify(data));
  return data;
}

/** Plain text (no parse mode, so Hebrew and punctuation are never misread as markup). */
export async function sendText(chatId, text) {
  let ok = true;
  for (const part of splitMessage(text)) {
    const r = await call('sendMessage', { chat_id: chatId, text: part });
    ok = ok && Boolean(r.ok);
    if (!r.ok) break;
  }
  return ok;
}

/** Registers the webhook; Telegram echoes the secret back on every update. */
export function setWebhook(url, secret) {
  return call('setWebhook', { url, secret_token: secret, allowed_updates: ['message'] });
}
