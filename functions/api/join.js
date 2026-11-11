// POST /api/join — 新朋友做完測驗，按「登上這艘船」
// body: { boat: '恩典漂漂船' | '浪子返航號' | '摩西分海號' }
import { DB, createPage, W, handle, json, verifyLine, findMember, readJson, todayTW, HttpError } from '../../lib/notion.js';

const BOATS = ['恩典漂漂船', '浪子返航號', '摩西分海號'];

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { boat } = await readJson(request);
  if (!BOATS.includes(boat)) throw new HttpError(400, '請選擇一艘小船');

  const exists = await findMember(env, user.userId);
  if (exists) return json({ ok: true, already: true });

  await createPage(env, DB.members, {
    '暱稱': W.title(user.name),
    'LINE userId': W.text(user.userId),
    '圈層': W.select('小船船員'),
    '狀態': W.status('待船長聯繫'),
    '測驗結果': W.select(boat),
    '來源': W.select('LIFF 測驗'),
    '加入日期': W.date(todayTW()),
  });
  // 船長通知：之後可以在這裡用 LINE Messaging API 推播給該船船長
  return json({ ok: true });
});
