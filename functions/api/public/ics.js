// GET /api/public/ics?id=<聚會 id> — 下載 .ics，加入手機／電腦日曆（台北時間）
import { DB, notion, P, handle, HttpError } from '../../../lib/notion.js';
import { parseTimes } from '../../../lib/time.js';

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => { const out = []; let s = line; while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); } out.push(s); return out.join('\r\n'); };

export const onRequestGet = handle(async ({ env, request }) => {
  const pid = (new URL(request.url).searchParams.get('id') || '').replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(pid)) throw new HttpError(400, '找不到這場聚會');
  const pg = await notion(env, 'pages/' + pid, null, 'GET');
  if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.events) throw new HttpError(404, '找不到這場聚會');
  const title = P.title(pg, 'Name'), date = (P.date(pg, 'Created') || '').slice(0, 10), note = P.text(pg, '備註');
  if (!date) throw new HttpError(404, '這場聚會還沒有日期');
  const t = parseTimes(date, note);
  const ymd = (d) => d.replace(/-/g, '');
  const dt = (s) => s.replace(/[-:]/g, '');
  const next = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//joyjesus//liff//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Taipei', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${pid}@joyjesus.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    ...(t.allDay ? [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(next(date))}`]
      : [`DTSTART;TZID=Asia/Taipei:${dt(t.start)}`, `DTEND;TZID=Asia/Taipei:${dt(t.end)}`]),
    `SUMMARY:${esc('揪喜樂｜' + title)}`,
    `DESCRIPTION:${esc((note ? note + '\n' : '') + '詳情：https://miniapp.line.me/2012557389-Jfp3TUw4/news')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="joyjesus-${date}.ics"`,
      'cache-control': 'public, max-age=300',
    },
  });
});
