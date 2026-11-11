// POST /api/board/heart — 「為你禱告／我也想知道」+1
// body: { id }
import { DB, notion, updatePage, P, W, handle, json, verifyLine, findMember, readJson, HttpError } from '../../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  if (!(await findMember(env, user.userId))) throw new HttpError(403, '登上小船之後就能使用船員甲板');
  const { id } = await readJson(request);
  if (!/^[0-9a-f]{32}$/.test(String(id || '').replace(/-/g, ''))) throw new HttpError(400, '找不到這則留言');
  const pg = await notion(env, 'pages/' + id, null, 'GET');
  const parent = (pg.parent?.database_id || '').replace(/-/g, '');
  if (parent !== DB.board) throw new HttpError(400, '找不到這則留言');
  const hearts = (P.num(pg, 'hearts') || 0) + 1;
  await updatePage(env, id, { hearts: W.num(hearts) });
  return json({ ok: true, hearts });
});
