// GET /api/event?id=<聚會 id> — 聚會詳情（需要 LINE 登入）：Notion 欄位＋頁面內文
// 不回傳「密碼」等敏感欄位。
import { DB, notion, P, handle, json, verifyLine, HttpError } from '../../lib/notion.js';
import { parseTimes } from '../../lib/time.js';

const plain = (rt) => (rt || []).map((t) => t.plain_text).join('');

export const onRequestGet = handle(async ({ env, request }) => {
  await verifyLine(env, request);
  const pid = (new URL(request.url).searchParams.get('id') || '').replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(pid)) throw new HttpError(400, '找不到這場聚會');
  const pg = await notion(env, 'pages/' + pid, null, 'GET');
  if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.events) throw new HttpError(404, '找不到這場聚會');

  // 頁面內文：段落、標題、清單、引言、圖片
  const blocks = [];
  try {
    const r = await notion(env, `blocks/${pid}/children?page_size=100`, null, 'GET');
    for (const b of r.results) {
      const v = b[b.type] || {};
      if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout', 'to_do'].includes(b.type)) {
        const text = plain(v.rich_text);
        if (text.trim()) blocks.push({ type: b.type, text, link: (v.rich_text || []).map((t) => t.href).find(Boolean) || null });
      } else if (b.type === 'image') {
        const url = v.file?.url || v.external?.url; if (url) blocks.push({ type: 'image', url });
      } else if (b.type === 'divider') blocks.push({ type: 'divider' });
    }
  } catch (e) { console.error(e); }

  const date = (P.date(pg, 'Created') || '').slice(0, 10);
  const note = P.text(pg, '備註');
  return json({
    id: pid,
    title: P.title(pg, 'Name'),
    date,
    times: parseTimes(date, note),
    note,
    type: P.select(pg, 'Tags'),
    kind: P.select(pg, '聚會形式'),
    speaker: P.text(pg, '主講') || P.select(pg, '主講') || '',
    host: P.text(pg, '主持') || P.select(pg, '主持') || '',
    link: pg.properties['網址']?.url || P.text(pg, '網址') || null,
    cover: pg.cover ? (pg.cover.file?.url || pg.cover.external?.url) : null,
    blocks,
  });
});
