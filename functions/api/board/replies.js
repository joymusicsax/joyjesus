// 船員甲板：代禱／提問的回應（連到既有的 Notion「留言回覆」）
// GET  /api/board/replies?post=<留言 id>
// POST /api/board/replies  body: { post, text, name, anon }
// 匿名回應時，稱呼一律存成「匿名旅人」，不記錄 LINE userId。
import { DB, notion, queryAll, createPage, P, W, id, handle, json, verifyLine, findMember, readJson, HttpError } from '../../../lib/notion.js';

const okId = (x) => /^[0-9a-f]{32}$/.test(String(x || '').replace(/-/g, ''));

async function requireMember(env, request) {
  const user = await verifyLine(env, request);
  if (!(await findMember(env, user.userId))) throw new HttpError(403, '登上小船之後就能使用船員甲板');
}
async function requirePost(env, postId) {
  if (!okId(postId)) throw new HttpError(400, '找不到這則留言');
  const pg = await notion(env, 'pages/' + postId, null, 'GET');
  if ((pg.parent?.database_id || '').replace(/-/g, '') !== DB.board) throw new HttpError(400, '找不到這則留言');
  return pg;
}

export const onRequestGet = handle(async ({ env, request }) => {
  await requireMember(env, request);
  const postId = new URL(request.url).searchParams.get('post');
  await requirePost(env, postId);
  const rows = await queryAll(env, DB.replies, {
    filter: { property: '回覆對象', relation: { contains: postId.replace(/-/g, '') } },
    sorts: [{ property: '回覆時間', direction: 'ascending' }],
  });
  return json({
    replies: rows.map((r) => {
      const anon = P.check(r, '是否想匿名');
      return { id: id(r), name: anon ? '匿名旅人' : (P.title(r, '回覆稱呼') || '旅人'), anon, text: P.text(r, '回覆內容'), time: r.created_time };
    }),
  });
});

export const onRequestPost = handle(async ({ env, request }) => {
  await requireMember(env, request);
  const body = await readJson(request);
  await requirePost(env, body.post);
  const text = String(body.text || '').trim();
  if (!text) throw new HttpError(400, '請寫下回應');
  if (text.length > 1000) throw new HttpError(400, '回應請在 1000 字以內');
  const anon = body.anon !== false || !String(body.name || '').trim();
  await createPage(env, DB.replies, {
    '回覆稱呼': W.title(anon ? '匿名旅人' : String(body.name).trim().slice(0, 30)),
    '回覆內容': W.text(text),
    '回覆對象': W.rel([String(body.post).replace(/-/g, '')]),
    '是否想匿名': W.check(anon),
  });
  return json({ ok: true });
});
