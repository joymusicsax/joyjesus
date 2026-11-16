// 船員探索問卷的題目（前後端共用：GET /api/survey 會把這份定義給 LIFF）
// type: multi 複選、single 單選、text 自由填寫、scale 1–5 分、pick 最多選 max 個
// col: 存進 Notion「🧭 船員探索問卷」的欄位；沒有 col 的題目只會寫進「完整回答」

export const SMALL_ROLE_MAP = {
  '我喜歡聽別人分享，也願意陪伴。': '陪伴',
  '我喜歡分享自己的想法與生命故事。': '分享',
  '我喜歡認識新朋友、介紹大家彼此認識。': '連結',
  '我喜歡發現有趣的內容，與大家交流。': '探索',
  '我喜歡在群體中給予鼓勵與支持。': '鼓勵',
};

// 「這個月只做一件小事」→ 對應的任務名稱（放在任務板最上面）
export const ONE_THING_MAP = {
  '主動認識一位團契夥伴': '主動認識一位團契夥伴',
  '分享一件最近的生活故事': '分享最近一件讓自己感到喜樂的事',
  '為一位夥伴代禱': '在船員甲板為一則代禱按「為你禱告」',
  '分享一首歌或一段經文': '在群組分享一首歌或一段經文',
  '參加一次實體聚會': '參加一次實體聚會',
  '暫時先認識團契，不急著承擔任務': null,
};

const ROLES6 = ['陪伴者', '創作者', '引導者', '行動者', '連結者', '倡議者'];
export const ROLE_DESC = {
  陪伴者: '關懷新朋友、代禱、生命陪伴',
  創作者: '海報、影音、文案、社群內容',
  引導者: '主持、查經、帶領討論、分享',
  行動者: '活動企劃、流程管理、執行',
  連結者: '邀請新朋友、外部合作、資源媒合',
  倡議者: '性別友善推廣、社區對話、生命故事分享',
};

export const SURVEYS = {
  small: {
    name: '小船問卷',
    title: '我在這裡，想找到什麼？',
    intro: '約 5–8 分鐘。沒有標準答案，依照你的真實感受回答就好。只有你、你的船長和督導看得到。',
    sections: [
      { title: 'A. 我為什麼來到揪喜樂？', items: [
        { key: 'expect', col: '期待', type: 'multi', q: '目前你期待從揪喜樂獲得什麼？', options: ['認識更多信仰夥伴', '有一個能安心分享的地方', '更認識聖經與信仰', '有人可以陪伴、代禱', '探索自我與信仰的關係', '參與性別友善的信仰群體', '找到可以一起服事的夥伴'] },
        { key: 'faith', col: '信仰狀態', type: 'multi', q: '目前你的信仰生活比較接近哪一種狀態？', options: ['正在探索信仰', '有信仰但最近比較少參與群體', '穩定參與教會或團契', '正在經歷信仰上的轉變', '希望重新建立與神的關係', '其他或不確定'] },
        { key: 'hope', type: 'multi', q: '你希望揪喜樂是一個怎樣的群體？', options: ['溫暖、彼此關心', '可以真誠分享、不需要偽裝', '能夠一起學習信仰', '有趣、生活化、沒有距離感', '能夠實際參與服事與行動', '可以自在地談論性別與生命議題'] },
        { key: 'wish', type: 'text', q: '如果揪喜樂能為你做一件事，你希望是什麼？', optional: true },
      ] },
      { title: 'B. 我喜歡怎樣與人建立關係？', items: [
        { key: 'interact', col: '互動偏好', type: 'multi', q: '你比較喜歡哪種互動？', options: ['LINE 文字聊天', 'Zoom 討論', '一對一談心', '實體聚會', '小組交流'] },
        { key: 'cared', col: '被關心的方式', type: 'multi', q: '你比較容易在哪種情況下感受到被關心？', options: ['別人主動問候', '有人願意聽我說', '有人為我禱告', '有人邀請我一起行動', '有人記得我的近況'] },
        { key: 'support', col: '陪伴方式', type: 'multi', q: '當你遇到困難時，希望夥伴怎麼陪伴你？', options: ['聽我分享', '陪我分析問題', '一起禱告', '給我實際協助', '先給我一些空間'] },
      ] },
      { title: 'C. 我可以怎麼參與？', note: '小船階段不要求服事，只是找到你舒服的參與方式。', items: [
        { key: 'roles', col: '角色', type: 'multi', q: '哪些描述比較像你？', options: Object.keys(SMALL_ROLE_MAP) },
        { key: 'onething', col: '這個月一件小事', type: 'single', q: '如果這個月只邀請你做一件小事，你最願意嘗試什麼？', options: Object.keys(ONE_THING_MAP) },
      ] },
    ],
  },
  big: {
    name: '大船問卷',
    title: '我的恩賜與使命探索',
    intro: '約 10–15 分鐘。不是心理測驗，也不是在找誰適合當幹部，而是幫你發現：我擅長什麼、喜歡做什麼、願意投入什麼。',
    sections: [
      { title: 'A. 發現我的能力與恩賜', note: '1 分＝完全不符合，5 分＝非常符合。不必刻意追求高分。', items: [
        { key: 's_care', col: '陪伴關懷', type: 'scale', q: '陪伴關懷：我善於傾聽別人的故事，察覺他人的情緒與需要。' },
        { key: 's_create', col: '創意設計', type: 'scale', q: '創意設計：我喜歡發想主題、設計視覺、製作影音或創造新點子。' },
        { key: 's_teach', col: '教學分享', type: 'scale', q: '教學分享：我樂於整理知識、分享信仰、帶領討論或教導別人。' },
        { key: 's_run', col: '活動執行', type: 'scale', q: '活動執行：我擅長規劃流程、安排細節，讓一件事情順利完成。' },
        { key: 's_link', col: '人際連結', type: 'scale', q: '人際連結：我喜歡認識不同的人，串連資源、媒合夥伴。' },
        { key: 's_adv', col: '議題倡議', type: 'scale', q: '議題倡議：我關心社會議題，願意為弱勢、平等與公義發聲。' },
        { key: 'praise', type: 'text', q: '別人通常會稱讚我哪方面的能力？', optional: true },
      ] },
      { title: 'B. 探索我願意扮演的角色', note: '「我會做什麼」和「我想做什麼」分開想。一個人可以有很多角色。', items: [
        { key: 'roles', col: '角色', type: 'pick', max: 3, q: '哪三種角色最吸引我？（最多 3 個）', options: ROLES6, desc: ROLE_DESC },
        { key: 'ready', col: '可以立即嘗試', type: 'multi', q: '哪些是我已經具備能力，可以立即嘗試的？', options: ROLES6, optional: true },
        { key: 'learn', col: '希望有人陪著學', type: 'multi', q: '哪些我有興趣，但希望有人陪我學習？', options: ROLES6, optional: true },
        { key: 'not', col: '目前不想承擔', type: 'multi', q: '哪些事情我目前不想承擔？', options: ROLES6, optional: true },
      ] },
      { title: 'C. 我的投入條件', note: '避免把熱情變成負擔，照實際狀況選就好。', items: [
        { key: 'time', col: '每月時間', type: 'single', q: '每月可以投入多少時間？', options: ['1–2 小時', '3–5 小時', '6–10 小時', '視情況而定'] },
        { key: 'team', col: '合作方式', type: 'single', q: '喜歡怎樣合作？', options: ['自己完成', '兩人合作', '小組合作', '帶領團隊'] },
        { key: 'term', col: '承擔多久', type: 'single', q: '希望承擔多久？', options: ['單次任務', '一個月', '一季', '長期參與'] },
        { key: 'need', col: '需要的支持', type: 'multi', q: '需要什麼支持？', options: ['有人陪我做', '提供教材', '明確流程', '自主發揮'] },
      ] },
      { title: 'D. 找到我們共同在乎的事', items: [
        { key: 'care_about', type: 'text', q: '在教會或社會中，你看見哪些人或哪些處境，需要有人陪伴或改變？', optional: true },
        { key: 'm1', type: 'text', q: '我希望在揪喜樂成為一個＿＿＿的人', optional: true, short: true },
        { key: 'm2', type: 'text', q: '並且與大家一起＿＿＿', optional: true, short: true },
      ] },
    ],
  },
};

// 驗證並整理回答。回傳 { props（Notion 欄位）, text（完整回答）, roles, oneThing }
export function normalizeSurvey(type, answers) {
  const def = SURVEYS[type];
  if (!def) throw new Error('問卷類型不正確');
  const a = answers || {};
  const props = {}, lines = [];
  let roles = [], oneThing = null;
  for (const sec of def.sections) {
    lines.push(`【${sec.title}】`);
    for (const it of sec.items) {
      let v = a[it.key];
      if (it.type === 'multi' || it.type === 'pick') {
        v = (Array.isArray(v) ? v : []).filter((x) => it.options.includes(x));
        if (it.type === 'pick') v = v.slice(0, it.max || 3);
        if (!v.length && !it.optional) throw new Error(`請回答：${it.q}`);
        if (it.col) props[it.col] = { multi_select: (it.key === 'roles' && type === 'small' ? v.map((x) => SMALL_ROLE_MAP[x]) : v).map((name) => ({ name })) };
        if (it.key === 'roles') roles = type === 'small' ? v.map((x) => SMALL_ROLE_MAP[x]) : v;
        lines.push(`${it.q}\n→ ${v.join('、') || '（未填）'}`);
      } else if (it.type === 'single') {
        if (!it.options.includes(v)) { if (it.optional) { lines.push(`${it.q}\n→ （未填）`); continue; } throw new Error(`請回答：${it.q}`); }
        if (it.col === '這個月一件小事') { props[it.col] = { rich_text: [{ text: { content: v } }] }; oneThing = v; }
        else if (it.col) props[it.col] = { select: { name: v } };
        lines.push(`${it.q}\n→ ${v}`);
      } else if (it.type === 'scale') {
        const n = Math.round(Number(v));
        if (!(n >= 1 && n <= 5)) throw new Error(`請評分：${it.q.split('：')[0]}`);
        props[it.col] = { number: n };
        lines.push(`${it.q}\n→ ${n} 分`);
      } else {
        const t = String(v || '').trim().slice(0, 500);
        if (!t && !it.optional) throw new Error(`請回答：${it.q}`);
        lines.push(`${it.q}\n→ ${t || '（未填）'}`);
      }
    }
  }
  if (type === 'big') {
    const m1 = String(a.m1 || '').trim(), m2 = String(a.m2 || '').trim();
    if (m1 || m2) props['使命宣言'] = { rich_text: [{ text: { content: `我希望在揪喜樂成為一個${m1 || '＿＿'}的人，並且與大家一起${m2 || '＿＿'}。`.slice(0, 300) } }] };
  }
  return { props, text: lines.join('\n').slice(0, 1990), roles, oneThing };
}
