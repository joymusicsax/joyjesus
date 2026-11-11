// 船員甲板：代禱事項／提問板（連到既有的 Notion「團契留言板」）
// GET  /api/board?kind=pray|ask
// POST /api/board  body: { kind, text, name, anon }
// 匿名送出時，稱呼一律存成「匿名旅人」，而且不記錄 LINE userId。
import { DB, notion, createPage, P, W, id, handle, json, verifyLine, findMember, readJson, HttpError } from '../../../lib/notion.js';

const KIND = { pray: '我要禱告', ask: '我要發問' };

async function requireMember(env, request) {
  const user = await verifyLine(env, request);
  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '登上小船之後就能使用船員甲板');
  return { user, m };
}

export const onRequestGet = handle(async ({ env, request }) => {
  await requireMember(env, request);
  const kind = new URL(request.url).searchParams.get('kind') === 'ask' ? 'ask' : 'pray';
  const r = await notion(env, `databases/${DB.board}/query`, {
    filter: { property: '選擇上面的項目', select: { equals: KIND[kind] } },
    sorts: [{ property: '送出時間', direction: 'descending' }],
    page_size: 50,
  });
  const posts = r.results.map((pg) => {
    const anon = P.check(pg, '是否想匿名');
    return {
      id: id(pg),
      name: anon ? '匿名旅人' : (P.title(pg, '稱呼') || '旅人'),
      anon,
      text: P.text(pg, '內容'),
      hearts: P.num(pg, 'hearts') || 0,
      replies: P.rel(pg, '回覆').length,
      time: pg.created_time,
    };
  });
  return json({ kind, posts });
});

export const onRequestPost = handle(async ({ env, request }) => {
  await requireMember(env, request);
  const body = await readJson(request);
  const kind = body.kind === 'ask' ? 'ask' : 'pray';
  const text = String(body.text || '').trim();
  if (!text) throw new HttpError(400, '請寫下內容');
  if (text.length > 1000) throw new HttpError(400, '內容請在 1000 字以內');
  const anon = body.anon !== false || !String(body.name || '').trim();
  await createPage(env, DB.board, {
    '稱呼': W.title(anon ? '匿名旅人' : String(body.name).trim().slice(0, 30)),
    '內容': W.text(text),
    '選擇上面的項目': W.select(KIND[kind]),
    '是否想匿名': W.check(anon),
    'hearts': W.num(0),
  });
  return json({ ok: true });
});
