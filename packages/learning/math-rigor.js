export const RIGOR_SAMPLE_ID = 'SEQ-INTEGRAL';
export const RIGOR_TERMS = Object.freeze([2, 5, 12, 25]);

export function integralPeakValue(x, n) {
  return (n + 1) * (n + 2) * x ** n * (1 - x);
}

export function integralPeakArea(n, lo = 0, hi = 1) {
  const primitive = x => x ** (n + 1) * (1 + (n + 1) * (1 - x));
  return primitive(hi) - primitive(lo);
}

export const RIGOR_NOTE_FIELDS = {
  observation: ['观察', '算三个具体例子。固定位置与峰顶的数值分别如何变化？'],
  conjecture: ['猜想', '把规律写成可以检验的命题。你预期积分会怎样变化？'],
  counterexample: ['检验', '删去一个条件、改变区间，或者找一个能推翻猜想的例子。'],
  preciseStatement: ['精确化', '写下定义域、量词顺序与需要控制的误差。'],
  proofMechanism: ['证明', '写出关键估计，并指出它使用了哪个条件。'],
  nextQuestion: ['再发现', '提取可迁移的思想，再提出一个可以着手检验的新问题。']
};

export const DAILY_RIGOR_TASKS = Object.freeze([
  ['examples', '亲手计算三个具体例子'],
  ['conjecture', '提出一个自己的数学猜想'],
  ['test', '尝试改变条件或寻找反例'],
  ['proof', '独立完成一次严格的证明'],
  ['transfer', '提取一个能够迁移到其他题目的方法']
]);

export function localRigorDate(date = new Date()) {
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

export function rigorDateFromSubject(id) {
  const date = /^RIGOR-DAY-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];
  if (!date || date.startsWith('0000')) return null;
  const parsed = new Date(date + 'T00:00:00.000Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export const rigorDailySubject = date => 'RIGOR-DAY-' + date;

export function validDailyRigorTasks(tasks) {
  return Array.isArray(tasks) && new Set(tasks).size === tasks.length &&
    tasks.every(task => DAILY_RIGOR_TASKS.some(([id]) => id === task));
}

