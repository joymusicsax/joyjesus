// GET  /api/survey?type=small|big — 問卷題目（＋自己上一次的回答時間）
// POST /api/survey  body: { type, answers } — 送出問卷：寫進「🧭 船員探索問卷」、更新成員名冊「參與角色」、自動完成對應的成長任務
import { DB, createPage, updatePage, P, W, id, handle, json, verifyLine, findMember, readJson, nowTW, HttpError,
  autoComplete, longText } from '../../lib/notion.js';
import { SURVEYS, normalizeSurvey } from '../../lib/survey.js';

const TYPE_NAME = { small: '小船問卷', big: '大船問卷' };

export const onRequestGet = handle(async ({ env, request }) => {
  await verifyLine(env, request);
  const type = new URL(request.url).searchParams.get('type');
  if (!SURVEYS[type]) throw new HttpError(400, '問卷類型不正確');
  return json({ survey: SURVEYS[type] });
});

export const onRequestPost = handle(async ({ env, request }) => {
  const user = await verifyLine(env, request);
  const { type, answers } = await readJson(request);
  const m = await findMember(env, user.userId);
  if (!m) throw new HttpError(403, '請先登上一艘小船');
  const circle = P.select(m, '圈層') || '小船船員';
  if (type === 'big' && circle === '小船船員') throw new HttpError(403, '大船問卷登上大船後就會解鎖');

  let r;
  try { r = normalizeSurvey(type, answers); } catch (e) { throw new HttpError(400, e.message); }
  const nick = P.title(m, '暱稱');
  const now = nowTW();
  await createPage(env, DB.survey, {
    ...r.props,
    '紀錄': W.title(`${nick}｜${TYPE_NAME[type]}｜${now.slice(0, 10)}`),
    '問卷': W.select(TYPE_NAME[type]),
    '成員': W.rel([id(m)]),
    '送出時間': W.datetime(now),
    '完整回答': longText(r.text),
  });

  // 大船問卷選的三個角色寫回成員名冊；小船的傾向不覆蓋大船角色
  const partProps = {};
  if (type === 'big' && r.roles.length) partProps['參與角色'] = { multi_select: r.roles.map((name) => ({ name })) };
  partProps['最後互動日'] = W.datetime(now);
  await updatePage(env, id(m), partProps).catch((e) => console.error(e));

  const done = await autoComplete(env, m, TYPE_NAME[type]).catch((e) => { console.error(e); return []; });
  return json({ ok: true, thanks: done[0]?.thanks || '', oneThing: r.oneThing });
});
