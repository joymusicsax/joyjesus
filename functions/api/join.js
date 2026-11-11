// POST /api/join — 新朋友做完測驗，按「登上這艘船」
// body: { boat: '恩典漂漂船' | '浪子返航號' | '摩西分海號', place: 縣市或國家（必填，'其他' 時帶 placeOther）, intro?: string, introScope?: '只給船長'|'同船'|'全團契' }
// 1. 建立成員，先掛在測驗結果那艘船（之後可在 Notion 改）
// 2. 官方帳號推播入口群組邀請給新朋友、新船員通知給該船船長（有設定 LINE_OA_TOKEN 才會發）
import { DB, notion, createPage, updatePage, P, W, id, handle, json, verifyLine, findMember, readJson, todayTW, HttpError,
  boatMap, pushLine, ENTRY_GROUP_URL, ENTRY_GROUP_MSG, parsePlace, completeIntroQuest } from '../../lib/notion.js';

const BOATS = ['恩典漂漂船', '浪子返航號', '摩西分海號'];
const SCOPES = ['只給船長', '同船', '全團契'];

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { boat, intro, introScope, place, placeOther } = await readJson(request);
  if (!BOATS.includes(boat)) throw new HttpError(400, '請選擇一艘小船');
  const loc = parsePlace(place, placeOther);
  const scope = SCOPES.includes(introScope) ? introScope : '只給船長';
  const introText = String(intro || '').trim().slice(0, 500);

  const exists = await findMember(env, user.userId);
  if (exists) return json({ ok: true, already: true, groupUrl: ENTRY_GROUP_URL, groupMsg: ENTRY_GROUP_MSG });

  const bm = await boatMap(env);
  const boatId = bm.byName[boat];
  const props = {
    '暱稱': W.title(user.name),
    'LINE userId': W.text(user.userId),
    '圈層': W.select('小船船員'),
    '狀態': W.status('待船長聯繫'),
    '測驗結果': W.select(boat),
    '來源': W.select('LIFF 測驗'),
    '加入日期': W.date(todayTW()),
    '介紹公開範圍': W.select(scope),
    '居住地區': W.text(loc.place),
    '地區': W.select(loc.area),
  };
  if (boatId) props['所屬小船'] = W.rel([boatId]);
  if (introText) props['自我介紹'] = W.text(introText);
  const page = await createPage(env, DB.members, props);

  // 送出自我介紹＝完成第一個任務
  await completeIntroQuest(env, id(page), user.name).catch((e) => console.error(e));

  // 推播：新朋友 → 入口群組邀請
  const sent = await pushLine(env, user.userId, `${ENTRY_GROUP_MSG}\n👉 ${ENTRY_GROUP_URL}`);
  if (sent) await updatePage(env, id(page), { '入口群組': W.check(true) }).catch(() => {});

  // 推播：該船船長 → 新船員通知
  if (boatId) {
    const capIds = P.rel(bm.byId[boatId], '船長');
    await Promise.all(capIds.map(async (cid) => {
      const cap = await notion(env, 'pages/' + cid, null, 'GET').catch(() => null);
      const to = cap && P.text(cap, 'LINE userId');
      if (to) await pushLine(env, to, `⛵ 新船員登上了${boat}：${user.name}\n請到船長甲板看看，並邀請他進小船群組。\nhttps://miniapp.line.me/2012557389-Jfp3TUw4/deck`);
    }));
  }
  return json({ ok: true, groupUrl: ENTRY_GROUP_URL, groupMsg: ENTRY_GROUP_MSG });
});
