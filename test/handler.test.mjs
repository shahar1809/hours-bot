// Handler flow test with an in-memory @netlify/blobs replacement.
import { mock } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
mock.module('@netlify/blobs', {
  namedExports: {
    getStore: () => ({
      get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null),
      setJSON: async (k, v) => { mem.set(k, structuredClone(v)); },
    }),
  },
});
const { handleText } = await import('../lib/handler.mjs');
const U = '1';
const say = (t) => handleText(U, t);

await say('לבצלר 4 שעות');
await say('לאורו נלך 14:00 עד 16:00');
await say('בית ספר 3 שעות');
let r = await say('רשימה');
assert.match(r, /1\. .*\n2\. .*\n3\. /);
assert.match(await say('מחק 9'), /אין רישום מספר 9/);
r = await say('מחק 2');
assert.match(r, /נמחק/); assert.match(r, /נשארו 2/);
assert.match(await say('מחק 1'), /שלחי קודם "רשימה"/); // list invalidated after a delete
r = await say('רשימה');
assert.equal(r.split('\n').filter((l) => /^\d+\./.test(l)).length, 2);
assert.match(await say('דוח'), /סה״כ = 7 שעות/);

// stale numbers: add an entry after listing -> numbering must be re-requested
await say('רשימה'); await say('עוד מקום 1 שעה');
assert.match(await say('מחק 1'), /שלחי קודם "רשימה"/);

// clear month: needs confirmation, other message cancels
assert.match(await say('נקה חודש'), /אישור/);
assert.match(await say('דוח'), /דוח שעות/);
assert.match(await say('אישור'), /אין רישומים|לא הבנתי/); // cancelled; bare "אישור" is not a valid entry
assert.match(await say('נקה חודש'), /3 הרישומים/);
assert.match(await say('אישור'), /נמחקו 3 רישומים/);
assert.match(await say('דוח'), /אין רישומים/);
assert.match(await say('נקה חודש'), /אין רישומים/);
console.log('handler tests passed');
process.exit(0);
