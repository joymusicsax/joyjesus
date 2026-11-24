// POST /api/email — 已登船的成員補填 Email（舊資料沒填的人，開啟 LIFF 時會跳出提醒）
// body: { email }
import { updatePage, W, id, handle, json, verifyLine, findMember, readJson, cleanEmail, HttpError } from '../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const me = await findMember(env, user.userId);
  if (!me) throw new HttpError(403, '請先登上一艘小船');
  const { email } = await readJson(request);
  await updatePage(env, id(me), { 'Email': W.email(cleanEmail(email)) });
  return json({ ok: true });
});
