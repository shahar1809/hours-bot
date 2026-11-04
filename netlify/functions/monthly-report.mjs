// Runs daily; on the last day of the month (Israel time) it sends the report.
import { ilDate, monthKey } from '../../lib/parse.mjs';
import { buildReport } from '../../lib/report.mjs';
import { getEntries, getState, saveState, allowedUsers } from '../../lib/store.mjs';
import { sendText } from '../../lib/tg.mjs';

// 17:00 UTC = 19:00 or 20:00 in Israel, depending on daylight saving
export const config = { schedule: '0 17 * * *' };

export default async () => {
  const today = ilDate(0);
  const tomorrow = ilDate(1);
  if (monthKey(today) === monthKey(tomorrow)) return; // not the last day

  const mk = monthKey(today);
  for (const user of allowedUsers()) {
    const state = await getState(user);
    if (state.lastAutoReport === mk) continue; // already sent this month

    const ok = await sendText(user, buildReport(mk, await getEntries(user, mk)));
    if (ok) await saveState(user, { ...(await getState(user)), lastAutoReport: mk });
  }
};
