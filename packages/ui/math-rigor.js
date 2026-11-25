import {DAILY_RIGOR_TASKS} from '../learning/math-rigor.js';

const contrasts = [
  ['目标', '防止错误', '发现新的认识'],
  ['定义', '记准表述', '理解定义为何产生'],
  ['条件', '检查是否满足', '弄清条件控制了什么'],
  ['反例', '否定错误命题', '辨认尚未认识的结构'],
  ['证明', '确保结论成立', '提取结论成立的机制'],
  ['定理', '掌握已有结论', '把结论变成继续探索的工具']
];
const methods = [
  ['夹逼准则', '通过上下界控制未知对象。'],
  ['数学归纳法', '用初始情形与递推建立整体性质。'],
  ['柯西准则', '通过控制项与项之间的距离判定收敛，无需先知道极限。'],
  ['紧致性论证', '利用有限子覆盖或收敛子列，把局部约束转化为全局结论。'],
  ['构造双射', '通过一一对应揭示共同结构。'],
  ['反证法', '考察否定命题，找到与已知约束的冲突。']
];

export const RIGOR_PROOF = String.raw`### 为什么反例中的面积不变？

由 $x^n(1-x)=x^n-x^{n+1}$ 得到
$$
\int_0^1 f_n(x)\,dx=(n+1)(n+2)\left(\frac1{n+1}-\frac1{n+2}\right)=1.
$$

固定 $0\le x<1$ 时，$x^n$ 的指数衰减压过系数的多项式增长。$x=1$ 时每一项都为零。峰顶位于 $x_n=n/(n+1)$，峰高为 $(n+2)(n/(n+1))^n$，随 $n$ 增大而趋向无穷。

### 一致收敛控制了什么？

设 $f_n$ 在有限闭区间 $[a,b]$ 上黎曼可积，且一致收敛到 $f$。此时 $f$ 也黎曼可积。积分误差满足
$$
\begin{aligned}
\left|\int_a^b f_n(x)\,dx-\int_a^b f(x)\,dx\right|
&\le \int_a^b |f_n(x)-f(x)|\,dx\\
&\le (b-a)\sup_{x\in[a,b]}|f_n(x)-f(x)|.
\end{aligned}
$$

**可以带走的思想**：先用范数控制输入误差，再用一个统一的常数控制运算后的误差。这里积分是上确界范数下的连续线性泛函，常数可以取区间长度。

### 能否减弱条件？

若 $\int_a^b |f_n-f|\to 0$，第一道不等式已经足够。试比较 $g_n(x)=x^n$ 与上面的峰：在 $[0,1]$ 上，$g_n$ 不一致收敛到它的逐点极限，但积分误差为 $1/(n+1)$，仍趋于零。你能否找到别的运算，需要控制不同的误差？
`;

export function renderRigorReference() {
  return '<section class="math-discovery-paper math-rigor-reference">' +
    '<h3>严格性如何推动发现？</h3><p>正确性是基础。进一步追问定义、条件和证明为何有效，才能把一个结论变成下一个问题的工具。</p>' +
    '<details class="math-discovery-reveal"><summary>对照两种严格性</summary>' +
    '<div class="math-rigor-scroll" role="region" aria-label="两种严格性的对照" tabindex="0"><table class="math-discovery-value-table math-rigor-comparison">' +
    '<thead><tr><th scope="col">关注点</th><th scope="col">防御性的严格性</th><th scope="col">富有成果的严格性</th></tr></thead><tbody>' +
    contrasts.map(([label, defensive, productive]) => '<tr><th scope="row">' + label + '</th><td>' + defensive + '</td><td>' + productive + '</td></tr>').join('') +
    '</tbody></table></div></details>' +
    '<details class="math-discovery-reveal"><summary>从证明中提取可迁移的思想</summary><dl class="math-method-definition">' +
    methods.map(([name, idea]) => '<dt>' + name + '</dt><dd>' + idea + '</dd>').join('') +
    '</dl></details></section>';
}

export function renderRigorDaily(date) {
  return '<section class="math-discovery-paper math-rigor-daily" aria-labelledby="rigorDailyTitle">' +
    '<header><h3 id="rigorDailyTitle">每日数学发现训练</h3><output id="rigorDailyCount" aria-label="已完成项数" aria-live="polite"></output></header>' +
    '<p>每天约 45—60 分钟，围绕一个小问题深入。任选一项开始，必要时回到前面的观察。</p>' +
    '<label class="math-discovery-compare-label">训练日期<input type="date" id="rigorDailyDate" value="' + date + '"></label>' +
    '<div class="math-rigor-checklist">' +
    DAILY_RIGOR_TASKS.map(([id, title]) => '<label><input type="checkbox" data-rigor-task="' + id + '"><span>' + title + '</span></label>').join('') +
    '</div><footer><button type="button" id="rigorDailyReset">重置所选日期</button></footer></section>';
}

export function updateRigorDaily(root, tasks) {
  for (const item of root.querySelectorAll('[data-rigor-task]')) item.checked = tasks.includes(item.dataset.rigorTask);
  root.querySelector('#rigorDailyCount').textContent = tasks.length + '/' + DAILY_RIGOR_TASKS.length;
  root.querySelector('#rigorDailyReset').disabled = tasks.length === 0;
}

