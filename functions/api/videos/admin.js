// 影片管理（只有督導可以用）
// GET  /api/videos/admin — 全部影片（含隱藏）
// POST /api/videos/admin — { action }：
//   add     { urls: "每行一個網址", date? }  批次新增（標題自動向 YouTube 取得）
//   update  { id, title?, date?, star?, show? }
//   move    { id, dir: -1|1 }  在同一列（同月份或星號列）內上移／下移
//   remove  { id }  從清單移除（Notion 的封存，可在 Notion 還原）
import { notion, createPage, updatePage, W, id, handle, json, readJson, HttpError, verifyLine, findMember, isSupervisor } from '../../../lib/notion.js';
import { DB } from '../../../lib/notion.js';
import { allVideos, sortVideos, parseVid } from '../../../lib/videos.js';

async function requireSupervisor(env, request) {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m || !isSupervisor(m)) throw new HttpError(403, '只有督導可以管理影片');
}
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const okId = (s) => /^[0-9a-f]{32}$/.test(String(s || '').replace(/-/g, ''));
const rowKey = (v) => (v.star ? '★' : v.date ? v.date.slice(0, 7) : '-');

export const onRequestGet = handle(async ({ env, request }) => {
  await requireSupervisor(env, request);
  return json({ videos: (await allVideos(env)).sort(sortVideos) });
});

async function ytTitle(vid) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid));
    if (r.ok) return String((await r.json()).title || '').slice(0, 200);
  } catch (e) { /* 取不到就用預設 */ }
  return '';
}

export const onRequestPost = handle(async ({ env, request }) => {
  await requireSupervisor(env, request);
  const b = await readJson(request);
  const act = b.action;

  if (act === 'add') {
    const lines = String(b.urls || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 60);
    const vids = [...new Set(lines.map(parseVid).filter(Boolean))];
    if (!vids.length) throw new HttpError(400, '沒有找到 YouTube 網址，請一行貼一個');
    const existing = new Set((await allVideos(env)).map((v) => v.vid));
    const fresh = vids.filter((v) => !existing.has(v));
    const date = okDate(b.date) ? b.date : null;
    let added = 0;
    for (const vid of fresh) {           // 依序新增，排序數字接在最後
      const title = (await ytTitle(vid)) || '（請補標題）' + vid;
      const props = { '標題': W.title(title), '影片ID': W.text(vid), '星號': W.check(false), '顯示': W.check(true), '排序': W.num(Date.now() % 1e9 / 1000 + added) };
      if (date) props['日期'] = W.date(date);
      await createPage(env, DB.videos, props);
      added++;
    }
    return json({ ok: true, added, skipped: vids.length - fresh.length });
  }

  if (!okId(b.id)) throw new HttpError(400, '找不到這部影片');
  const pid = String(b.id).replace(/-/g, '');
  const pg = await notion(env, 'pages/' + pid, null, 'GET');
  if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.videos) throw new HttpError(400, '找不到這部影片');

  if (act === 'update') {
    const props = {};
    if (typeof b.title === 'string') { const t = b.title.trim(); if (!t) throw new HttpError(400, '標題不能空白'); props['標題'] = W.title(t.slice(0, 200)); }
    if (b.date !== undefined) props['日期'] = okDate(b.date) ? W.date(b.date) : { date: null };
    if (b.star !== undefined) props['星號'] = W.check(b.star);
    if (b.show !== undefined) props['顯示'] = W.check(b.show);
    await updatePage(env, pid, props);
    return json({ ok: true });
  }

  if (act === 'remove') {
    await notion(env, 'pages/' + pid, { archived: true }, 'PATCH');
    return json({ ok: true });
  }

  if (act === 'move') {
    const dir = b.dir === -1 ? -1 : 1;
    const all = (await allVideos(env)).sort(sortVideos);
    const me = all.find((v) => v.id === pid);
    if (!me) throw new HttpError(404, '找不到這部影片');
    const row = all.filter((v) => rowKey(v) === rowKey(me));   // 同一列的影片，維持目前顯示順序
    const i = row.findIndex((v) => v.id === pid), j = i + dir;
    if (j < 0 || j >= row.length) return json({ ok: true });
    [row[i], row[j]] = [row[j], row[i]];
    // 整列重新編號，只寫有變動的
    const base = 1;
    await Promise.all(row.map((v, n) => (v.order === base + n ? null : updatePage(env, v.id, { '排序': W.num(base + n) }))));
    return json({ ok: true });
  }

  throw new HttpError(400, '不支援的操作');
});
