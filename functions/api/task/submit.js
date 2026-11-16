// POST /api/task/submit — 「文字送出」型的成長任務：船員寫下內容送出，系統就自動完成（不用船長確認）
// body: { questId, text }
import { notion, P, handle, json, verifyLine, findMember, readJson, HttpError, autoComplete } from '../../../lib/notion.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { questId, text } = await readJson(request);
  if (!/^[0-9a-f]{32}$/.test(String(questId || '').replace(/-/g, ''))) throw new HttpError(400, '任務不存在');
  const t = String(text || '').trim();
  if (t.length < 2) throw new HttpError(400, '請寫下想分享的內容');
  if (t.length > 2000) throw new HttpError(400, '內容請在 2000 字以內');

  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '請先登上一艘小船');
  const q = await notion(env, 'pages/' + questId.replace(/-/g, ''), null, 'GET');
  if (!P.check(q, '啟用') || P.select(q, '檢核方式') !== '文字送出') throw new HttpError(400, '這個任務不是用文字送出完成的');

  const done = await autoComplete(env, m, '文字送出', { questId: questId.replace(/-/g, ''), note: t });
  if (!done.length) return json({ ok: true, already: true });
  return json({ ok: true, thanks: done[0].thanks });
});
