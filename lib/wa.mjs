// WhatsApp Cloud API sending.
import { splitMessage } from './report.mjs';

const API = 'https://graph.facebook.com/v21.0';

async function post(payload) {
  const res = await fetch(`${API}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error('WhatsApp send failed', res.status, JSON.stringify(data));
  return { ok: res.ok, data };
}

/** Free-form text. Only works inside the 24h window after her last message. */
export async function sendText(to, text) {
  let ok = true;
  for (const part of splitMessage(text)) {
    const r = await post({ to, type: 'text', text: { body: part } });
    ok = ok && r.ok;
    if (!r.ok) break;
  }
  return ok;
}

/** Approved template, used to re-open the window when free-form fails. */
export async function sendTemplate(to, name, lang = 'he') {
  return (await post({ to, type: 'template', template: { name, language: { code: lang } } })).ok;
}
