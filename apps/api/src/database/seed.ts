import 'reflect-metadata';
import { Course, CourseContent, Level } from '../models';
import { sequelize } from './connection';
const titles = ['認識生成式 AI：從第一個提示開始', '設計可重用的 AI 工作流程', '評估 AI 輸出：建立專業判斷框架'];
const descriptions = [
  '理解 AI 能做甚麼，練習把目標、背景和輸出格式說清楚。',
  '把重複的非臨床工作拆解成可檢查的步驟，建立自己的提示模板。',
  '辨認不確定性與錯誤，設計人工覆核流程，建立負責任的 AI 使用習慣。',
];
export function demoContent(level: Level, index = 0): CourseContent {
  return {
    title: titles[index],
    subtitle: ['把好奇，變成第一步。', '從一次提問，到有系統的應用。', '讓工具的效率，配合你的判斷。'][index],
    description: descriptions[index],
    level,
    ai_tool: 'general',
    duration_minutes: [35, 50, 65][index],
    credit_cost: [10, 15, 20][index],
    pass_score: 80,
    cpd: { status: 'unaccredited' },
    lessons: [
      {
        id: 'introduction',
        title: '歡迎來到你的 AI 學習旅程',
        kind: 'text',
        content: `這是一門供平台驗收的示範課，並非正式持續專業進修教材。\n\n${descriptions[index]}\n\n學習目標\n一、說明生成式 AI 的用途與限制。\n二、使用清晰的目標、背景、限制及格式撰寫提示。\n三、在採用輸出前加入人工查核。\n\n你可以直接參加測驗，不需要完成指定觀看時間。達到 80 分即可取得示範完成證書。`,
      },
      {
        id: 'practice',
        title: '動手練習：寫一個清晰的提示',
        kind: 'text',
        content:
          '練習情境：為同事設計一份非臨床的 AI 入門工作坊議程。\n\n提示範例\n「請為初次使用 AI 的物理治療師設計一個 30 分鐘工作坊議程。內容包括基本概念、提示練習和人工覆核。以繁體中文表格列出時間、活動及學習目標。請不要加入臨床建議。」\n\n試著修改對象、時長或輸出格式，觀察結果。只使用虛構或非個人資料；不要輸入可識別病人資料。\n\n任何看似合理的 AI 輸出，仍需要由你判斷是否正確及適用。',
      },
    ],
    questions: [
      {
        id: 'q1',
        prompt: '哪一個提示最清晰？',
        options: ['幫我做一些東西', '列出一個 30 分鐘 AI 入門工作坊的議程，以繁中表格呈現', '隨便寫一些內容'],
        answer: 1,
        explanation: '清晰提示包含目標、背景、限制及輸出格式。',
      },
      {
        id: 'q2',
        prompt: '使用 AI 輸出前應怎樣處理？',
        options: ['直接採用', '只看文字是否流暢', '按用途查核事實及適用性'],
        answer: 2,
        explanation: '文字流暢不代表正確；應加入人工覆核。',
      },
      {
        id: 'q3',
        prompt: '練習時應使用甚麼資料？',
        options: ['真實病人完整紀錄', '虛構或不涉及個人資料的情境', '同事的帳戶密碼'],
        answer: 1,
        explanation: '本平台練習使用虛構、非個人資料。',
      },
      {
        id: 'q4',
        prompt: 'AI 回答引用了文獻，下一步是？',
        options: ['核對原始來源是否存在及支持說法', '直接複製引用', '只檢查文獻標題'],
        answer: 0,
        explanation: 'AI 可能產生不存在或不支持說法的引用。',
      },
      {
        id: 'q5',
        prompt: '這門示範課的完成條件是？',
        options: ['觀看全部內容', '測驗達 80 分', '購買點數'],
        answer: 1,
        explanation: '通過測驗便可完成，觀看進度不是門檻。',
      },
    ],
  };
}
export async function seed() {
  for (const [i, level] of (['beginner', 'advanced', 'master'] as Level[]).entries())
    await Course.findOrCreate({
      where: { id: `demo-${level}` },
      defaults: { draft: demoContent(level, i), is_demo: true, archived: false },
    });
}
if (require.main === module)
  seed()
    .then(() => sequelize.close())
    .catch(() => {
      console.error('示範課建立失敗');
      process.exitCode = 1;
    });
