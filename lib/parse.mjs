// Date helpers (Israel time) and the Hebrew free-text parser.

const TZ = 'Asia/Jerusalem';
const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD in Israel time, offset by whole days. */
export function ilDate(offsetDays = 0, now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(
    new Date(now + offsetDays * 86400000)
  );
}

export const monthKey = (isoDate) => isoDate.slice(0, 7);

export function prevMonthKey(mk) {
  let [y, m] = mk.split('-').map(Number);
  m -= 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${y}-${pad(m)}`;
}

/** Strip direction marks, normalise dashes and whitespace. */
export const clean = (s) =>
  String(s)
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[–—‑−־]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const EXAMPLES = 'דוגמאות: "לבצלר 4 שעות" או "לאורו נלך 14:00 עד 16:00"';

/**
 * Parse a message like "לבצלר 4 שעות" or "לאורו נלך 14:00 עד 16:00".
 * Optional day: "אתמול", "שלשום", or "3/11".
 * Returns { date, place, minutes } or { error }.
 */
export function parseEntry(raw, now = Date.now()) {
  let t = clean(raw);
  let date = ilDate(0, now);

  // Relative day words
  const rel = [
    [/(^|\s)שלשום(?=\s|$)/, -2],
    [/(^|\s)אתמול(?=\s|$)/, -1],
    [/(^|\s)היום(?=\s|$)/, 0],
  ];
  for (const [re, off] of rel) {
    if (re.test(t)) { date = ilDate(off, now); t = t.replace(re, ' '); break; }
  }

  // Explicit date d/m or d/m/yyyy
  const dm = t.match(/(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/);
  if (dm) {
    const today = ilDate(0, now);
    const d = +dm[2], m = +dm[3];
    let y = dm[4] ? (dm[4].length === 2 ? 2000 + +dm[4] : +dm[4]) : +today.slice(0, 4);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (m < 1 || m > 12 || probe.getUTCMonth() !== m - 1) return { error: 'התאריך לא תקין.' };
    let iso = `${y}-${pad(m)}-${pad(d)}`;
    if (!dm[4] && iso > today) iso = `${y - 1}-${pad(m)}-${pad(d)}`; // e.g. 31/12 typed in January
    date = iso;
    t = t.replace(dm[0], ' ');
  }

  let minutes = null;

  // Time range: 14:00 עד 16:00 / 14-16 / 8:30-17:00 (optional leading "מ")
  const rg = t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:עד|-)\s*(\d{1,2})(?::(\d{2}))?/);
  if (rg) {
    const sh = +rg[1], sm = +(rg[2] ?? 0), eh = +rg[3], em = +(rg[4] ?? 0);
    if (sh > 23 || eh > 24 || sm > 59 || em > 59) return { error: 'השעות לא תקינות.' };
    const start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (end === start) return { error: 'שעת ההתחלה והסיום זהות.' };
    if (end < start) end += 1440; // overnight shift
    minutes = end - start;
    t = t.replace(rg[0], ' ');
  } else {
    // Duration forms, most specific first
    const forms = [
      [/(\d+)\s+וחצי\s+שעות?/, (m) => +m[1] + 0.5],
      [/שעה\s+וחצי/, () => 1.5],
      [/שעתיים(\s+וחצי)?/, (m) => 2 + (m[1] ? 0.5 : 0)],
      [/(\d+(?:[.,]\d+)?)\s*(?:שעות|שעה|ש['׳])/, (m) => parseFloat(m[1].replace(',', '.'))],
      [/(^|\s)שעה(?=\s|$)/, () => 1],
    ];
    for (const [re, f] of forms) {
      const m = t.match(re);
      if (m) { minutes = Math.round(f(m) * 60); t = t.replace(m[0], ' '); break; }
    }
  }

  // Bare trailing number = hours: "לבצלר 3", "לבצלר 2.5"
  if (minutes === null) {
    const m = t.match(/^(.*\S)\s+(\d+(?:[.,]\d+)?)$/);
    if (m) {
      const h = parseFloat(m[2].replace(',', '.'));
      if (h > 0 && h <= 24) { minutes = Math.round(h * 60); t = m[1]; }
    }
  }

  if (minutes === null) return { error: `לא הבנתי את השעות. ${EXAMPLES}` };
  if (minutes <= 0 || minutes > 1440) return { error: 'מספר השעות לא תקין.' };

  // What remains is the place. Drop a dangling "מ" (from) and punctuation.
  const place = t
    .replace(/(^|\s)מ-?(?=\s|$)/g, ' ')
    .replace(/^[\s,.:;\-]+|[\s,.:;\-]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!place) return { error: `מה שם המקום? ${EXAMPLES}` };

  return { date, place, minutes };
}
