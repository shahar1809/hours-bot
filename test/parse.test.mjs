import assert from 'node:assert/strict';
import { parseEntry, prevMonthKey } from '../lib/parse.mjs';
import { buildReport } from '../lib/report.mjs';

// Fixed "now": Tue 2026-11-03 12:00 Israel time
const NOW = Date.parse('2026-11-03T10:00:00Z');
const ok = (input, exp) => {
  const r = parseEntry(input, NOW);
  assert.equal(r.error, undefined, `${input} -> ${r.error}`);
  assert.deepEqual(r, exp, input);
};
const bad = (input) => assert.ok(parseEntry(input, NOW).error, `expected error: ${input}`);

// The two formats from the brief
ok('לבצלר 4 שעות', { date: '2026-11-03', place: 'לבצלר', minutes: 240 });
ok('לבצלר 3', { date: '2026-11-03', place: 'לבצלר', minutes: 180 });
ok('אתמול לבצלר 2.5', { date: '2026-11-02', place: 'לבצלר', minutes: 150 });
ok('לאורו נלך 3', { date: '2026-11-03', place: 'לאורו נלך', minutes: 180 });
ok('לאורו נלך 14:00 עד 16:00', { date: '2026-11-03', place: 'לאורו נלך', minutes: 120 });

// Variants
ok('לבצלר 4.5 שעות', { date: '2026-11-03', place: 'לבצלר', minutes: 270 });
ok('לבצלר 4,5 שעות', { date: '2026-11-03', place: 'לבצלר', minutes: 270 });
ok('לבצלר 3 וחצי שעות', { date: '2026-11-03', place: 'לבצלר', minutes: 210 });
ok('לבצלר שעתיים', { date: '2026-11-03', place: 'לבצלר', minutes: 120 });
ok('לבצלר שעה וחצי', { date: '2026-11-03', place: 'לבצלר', minutes: 90 });
ok('לבצלר שעה', { date: '2026-11-03', place: 'לבצלר', minutes: 60 });
ok('לאורו נלך 8:30-17:00', { date: '2026-11-03', place: 'לאורו נלך', minutes: 510 });
ok('לאורו נלך מ-14:00 עד 16:30', { date: '2026-11-03', place: 'לאורו נלך', minutes: 150 });
ok('14:00 עד 16:00 לאורו נלך', { date: '2026-11-03', place: 'לאורו נלך', minutes: 120 });
ok('לאורו נלך 22:00 עד 02:00', { date: '2026-11-03', place: 'לאורו נלך', minutes: 240 });
ok('‏לבצלר 4 שעות‏', { date: '2026-11-03', place: 'לבצלר', minutes: 240 });

// Days
ok('אתמול לבצלר 4 שעות', { date: '2026-11-02', place: 'לבצלר', minutes: 240 });
ok('לבצלר 4 שעות שלשום', { date: '2026-11-01', place: 'לבצלר', minutes: 240 });
ok('1/11 לבצלר 4 שעות', { date: '2026-11-01', place: 'לבצלר', minutes: 240 });
ok('31/10 לאורו נלך 14:00 עד 16:00', { date: '2026-10-31', place: 'לאורו נלך', minutes: 120 });
ok('31/12 לבצלר 2 שעות', { date: '2025-12-31', place: 'לבצלר', minutes: 120 }); // future day-month -> last year

// Errors
bad('לבצלר');
bad('4 שעות');
bad('שלום מה נשמע');
bad('לבצלר 25 שעות');
bad('לבצלר 14:00 עד 14:00');
bad('32/13 לבצלר 4 שעות');

assert.equal(prevMonthKey('2026-01'), '2025-12');
assert.equal(prevMonthKey('2026-11'), '2026-10');

// Report rendering
const entries = [
  { date: '2026-11-03', place: 'לבצלר', minutes: 240, ts: 2 },
  { date: '2026-11-01', place: 'לאורו נלך', minutes: 120, ts: 1 },
  { date: '2026-11-02', place: 'לבצלר', minutes: 270, ts: 3 },
];
const report = buildReport('2026-11', entries);
assert.ok(report.includes('לבצלר:\n02/11 4.5\n03/11 4'));
assert.ok(report.includes('סה״כ: 10.5 שעות'));
console.log(report);
console.log('\nAll tests passed');
