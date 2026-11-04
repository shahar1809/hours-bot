// Persistence on Netlify Blobs. One JSON array of entries per user per month.
import { getStore } from '@netlify/blobs';

// Strong consistency: she may send "דוח" right after logging, so reads must see the latest write
const store = () => getStore({ name: 'hours', consistency: 'strong' });

export async function getEntries(user, mk) {
  return (await store().get(`${user}/${mk}`, { type: 'json' })) ?? [];
}
export async function saveEntries(user, mk, entries) {
  await store().setJSON(`${user}/${mk}`, entries);
}
export async function getState(user) {
  return (await store().get(`${user}/state`, { type: 'json' })) ?? {};
}
export async function saveState(user, state) {
  await store().setJSON(`${user}/state`, state);
}

/** Telegram user IDs allowed to use the bot (comma-separated digits in ALLOWED_USER_IDS). */
export const allowedUsers = () =>
  (process.env.ALLOWED_USER_IDS || '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);
