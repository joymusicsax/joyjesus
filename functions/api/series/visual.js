// POST /api/series/visual?id=<系列 id> — 上傳主視覺（督導）。body 是圖片本身（image/jpeg、image/png、image/webp）
// 圖片存進 Notion（File Upload API），掛在「🎨 團契系列」的「主視覺」欄位。
import { DB, notion, updatePage, handle, json, HttpError } from '../../../lib/notion.js';
import { requireSupervisor } from './admin.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const onRequestPost = handle(async ({ env, request }) => {
  await requireSupervisor(env, request);
  const pageId = (new URL(request.url).searchParams.get('id') || '').replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(pageId)) throw new HttpError(400, '找不到這個系列');
  const pg = await notion(env, 'pages/' + pageId, null, 'GET');
  if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.series) throw new HttpError(400, '找不到這個系列');

  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!TYPES[type]) throw new HttpError(400, '請上傳 JPG、PNG 或 WebP 圖片');
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) throw new HttpError(400, '沒有收到圖片');
  if (buf.byteLength > 4.5 * 1024 * 1024) throw new HttpError(400, '圖片請小於 4.5 MB');

  const filename = `主視覺-${pageId.slice(0, 6)}.${TYPES[type]}`;
  const up = await notion(env, 'file_uploads', { mode: 'single_part', filename, content_type: type });
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), filename);
  const res = await fetch(`https://api.notion.com/v1/file_uploads/${up.id}/send`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28' },
    body: form,
  });
  if (!res.ok) { const t = await res.text(); throw new HttpError(502, '圖片上傳到 Notion 失敗：' + t.slice(0, 200)); }
  await updatePage(env, pageId, { '主視覺': { files: [{ type: 'file_upload', file_upload: { id: up.id }, name: filename }] } });
  return json({ ok: true });
});
