// 從「備註」解析時間：「21:00–22:30」→ 起訖；「13:00 集合」→ 只有開始（預設 2 小時）；沒有 → 整天
export function parseTimes(date, note) {
  const m = String(note || '').match(/(\d{1,2}):(\d{2})(?:\s*[–\-~～至到]\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return { allDay: true, date };
  const pad = (n) => String(n).padStart(2, '0');
  const sh = +m[1], sm = +m[2];
  let eh = m[3] != null ? +m[3] : sh + 2, em = m[4] != null ? +m[4] : sm;
  let endDate = date;
  if (eh >= 24 || eh < sh) { eh = eh % 24; const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); endDate = d.toISOString().slice(0, 10); }
  return { allDay: false, start: `${date}T${pad(sh)}:${pad(sm)}:00`, end: `${endDate}T${pad(eh)}:${pad(em)}:00` };
}
