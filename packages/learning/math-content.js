// Versioned, original, publicly readable teaching content. These IDs must remain stable.
// User Knowledge records and study sessions are deliberately stored separately.
export const MATH_CONTENT_VERSION='math-content/1';
export const MATH_COURSES=Object.freeze([{
  id:'course-analysis-2',title:'数学分析（二）',description:'从函数列与函数项级数出发，理解极限运算为何需要额外的统一控制。',
  chapters:[{id:'chapter-uniform',title:'函数列：逐点收敛与一致收敛',description:'10 篇知识档案、20 道原创习题、5 个解题方法',status:'published',knowledgeIds:['K01','K02','K03','K04','K05','K06','K07','K08','K09','K10'],problemIds:Array.from({length:20},(_,i)=>`P${String(i+1).padStart(2,'0')}`)}]
}]);

const k=(id,title,kind,summary,body,prerequisites=[],tags=[])=>({id:`ANA-UC-${id}`,title,kind,summary,body,prerequisites:prerequisites.map(x=>`ANA-UC-${x}`),tags,courseId:'course-analysis-2',chapterId:'chapter-uniform'});
export const MATH_KNOWLEDGE=Object.freeze([
  k('K01','函数列与逐点收敛','definition','先固定一个点，再观察数列如何变化。',String.raw`# 问题从哪里来？
给定一列函数 $f_1,f_2,\ldots$，我们不仅想知道每个函数的性质，还想知道 $n$ 增大时是否出现一个共同的极限函数。

::: definition
设 $f_n:E\to\mathbb R$。若对每个 $x\in E$，数列 $(f_n(x))$ 都收敛于 $f(x)$，就称 $f_n$ 在 $E$ 上**逐点收敛**于 $f$。
:::

用量词表达为：
$$\forall x\in E\;\forall\varepsilon>0\;\exists N=N(\varepsilon,x)\;\forall n\ge N:\ |f_n(x)-f(x)|<\varepsilon.$$

这里的 $N$ 可以随所选的 $x$ 改变。逐点收敛等于在每个固定位置分别完成一次普通数列的极限证明。

::: example
$f_n(x)=x^n$ 在 $[0,1)$ 上逐点收敛于 $0$，因为每个固定的 $x<1$ 都满足 $x^n\to0$。
:::

**边界**：逐点收敛并不保证同一个 $N$ 对所有 $x$ 都适用，也不自动保留连续性。`,[],['函数列','极限']),
  k('K02','一致收敛的严格定义','definition','一个与位置无关的 N 同时控制整个定义域。',String.raw`# 为什么要更强的收敛？
逐点收敛只允许我们在每个点分别等待足够久；如果要统一控制整个函数的误差，就需要更严格的条件。

::: definition
$f_n:E\to\mathbb R$ **一致收敛**于 $f$，是指
$$\forall\varepsilon>0\;\exists N=N(\varepsilon)\;\forall n\ge N\;\forall x\in E:\ |f_n(x)-f(x)|<\varepsilon.$$
:::

最重要的变化是 $\exists N$ 出现在 $\forall x$ 之前：先根据误差容限选定 $N$，然后必须对整个 $E$ 有效。

这比逐点收敛强：一致收敛必逐点收敛，反之不然。

::: example
$f_n(x)=x/n$ 在 $[0,1]$ 上一致收敛于零，因为 $|x/n|\le 1/n$，取 $N>1/\varepsilon$ 即可。
:::

**边界**：一致收敛依赖指定的定义域；同一函数列在较小区间上可能一致，而在较大区间上不一致。`,['K01'],['量词','函数列']),
  k('K03','量词顺序与定义的否定','logic','怎样把“不能统一选择 N”写成可证明的反命题。',String.raw`# 两种逻辑结构
逐点：$\forall x\,\forall\varepsilon\,\exists N\,\forall n\ge N$。

一致：$\forall\varepsilon\,\exists N\,\forall n\ge N\,\forall x$。

交换 $\forall x$ 与 $\exists N$ 并非单纯改写文字，因为第二种表述不允许 $N$ 依赖 $x$。

::: theorem
一致收敛定义的否定是：存在某个 $\varepsilon_0>0$，使得对于每个 $N$，都能找到 $n\ge N$ 和 $x\in E$，使 $|f_n(x)-f(x)|\ge\varepsilon_0$。
:::

注意否定中的反例点 $x$ 可以随着 $n$ 改变。这正是构造非一致收敛反例的突破口。

**常见错误**：只找到一个固定 $x$ 使误差大，并不能反驳一个已经逐点收敛的函数列；要找的是“越到后期越需要靠边界的点”。`,['K01','K02'],['量词','反例']),
  k('K04','上确界判别','theorem','将全域误差压缩为一个实数序列。',String.raw`# 从逐点误差到全局误差
令 $e_n=\sup_{x\in E}|f_n(x)-f(x)|$（允许某些 $e_n=+\infty$）。

::: theorem
$f_n$ 在 $E$ 上一致收敛于 $f$，当且仅当 $e_n\to0$。
:::

**证明思路**：若 $e_n\to0$，则所有点的误差都被 $e_n$ 控制。反过来，若误差最终对所有 $x$ 均小于 $\varepsilon/2$，则 $e_n\le\varepsilon/2<\varepsilon$，因此上确界也趋于零。

::: example
在 $E=[0,1)$ 上，对 $f_n(x)=x^n$ 有 $\sup_{x\in E}x^n=1$。尽管这里的最大值并不取到，上确界仍为 $1$，所以并不一致收敛于零。
:::

**边界**：不要将上确界误写成最大值；非紧区间上的上确界未必能被某个点取得。`,['K02'],['上确界','判别']),
  k('K05','一致 Cauchy 准则','theorem','不知道极限函数时，也能通过尾项之间的距离判断。',String.raw`# 不依赖极限函数的判别
::: theorem
若值域为完备的 $\mathbb R$，函数列 $f_n:E\to\mathbb R$ 一致收敛，当且仅当
$$\forall\varepsilon>0\;\exists N\;\forall m,n\ge N\;\forall x\in E:\ |f_n(x)-f_m(x)|<\varepsilon.$$
:::

必要性来自三角不等式；充分性先在每个固定点应用实数列的 Cauchy 准则获得极限函数 $f$，再利用对所有 $x$ 的统一尾项估计，令 $m\to\infty$ 得到 $|f_n(x)-f(x)|\le\varepsilon/2$。

::: example
$f_n(x)=x/n$ 在 $[0,1]$ 上，$|f_n(x)-f_m(x)|\le1/n+1/m$，因此满足一致 Cauchy 准则。
:::

**边界**：如果目标值域不完备，Cauchy 性本身不保证存在值域内的极限。`,['K01','K02'],['Cauchy','判别']),
  k('K06','一致极限与连续性','theorem','为什么函数列的极限有时会突然变得不连续。',String.raw`# 极限与连续性能否交换？
::: theorem
若 $f_n:E\to\mathbb R$ 均在 $x_0\in E$ 处连续，且 $f_n$ 一致收敛于 $f$，则 $f$ 在 $x_0$ 处连续（这里取 $E$ 的相对拓扑）。
:::

**证明关键**：对任意 $\varepsilon>0$，先选定一个 $n$，让 $|f_n(x)-f(x)|$ 和 $|f_n(x_0)-f(x_0)|$ 对所有点均小于 $\varepsilon/3$，然后用这个固定的 $f_n$ 在 $x_0$ 处的连续性控制中间项。

$$|f(x)-f(x_0)|\le|f(x)-f_n(x)|+|f_n(x)-f_n(x_0)|+|f_n(x_0)-f(x_0)|.$$

::: example
$x^n$ 在 $[0,1]$ 上的逐点极限是 $f(x)=0$（$x<1$）以及 $f(1)=1$。这个极限在 $1$ 处不连续，所以收敛不可能一致。
:::

**边界**：不能把“连续函数的逐点极限连续”当作定理。`,['K02'],['连续性','一致极限']),
  k('K07','一致收敛与逐项积分','theorem','统一控制误差如何允许把极限移入积分号。',String.raw`# 积分是误差累积
::: theorem
若每个 $f_n$ 都在有界闭区间 $[a,b]$ 上 Riemann 可积，且 $f_n$ 一致收敛于 $f$，则 $f$ 可积，并有
$$\lim_{n\to\infty}\int_a^b f_n(x)\,dx=\int_a^b f(x)\,dx.$$
:::

**误差估计**：
$$\left|\int_a^b(f_n-f)\,dx\right|\le(b-a)\sup_{x\in[a,b]}|f_n(x)-f(x)|\longrightarrow0.$$

一致收敛保证任何位置的偏差都足够小，从而控制整个区间上的累积误差。

::: example
$f_n(x)=\sin x/n$ 在 $[0,\pi]$ 上一致趋于零，积分也趋于零。
:::

**边界**：积分收敛并不反过来推出一致收敛，例如 $x^n$ 在 $[0,1]$ 的积分趋零，但并不一致收敛。`,['K02','K04'],['积分','极限交换']),
  k('K08','非一致收敛反例的构造','method','让问题点随 n 向边界移动。',String.raw`# 反例并非“找一个坏点”
对于逐点收敛却非一致收敛的函数列，每个固定点往往都表现良好。困难在于无法同时控制整个定义域。

::: example
对 $f_n(x)=x^n$，取 $x_n=2^{-1/n}\in[0,1)$，就有 $f_n(x_n)=1/2$。无论 $n$ 多大，误差都保持在 $1/2$。
:::

这是对一致收敛定义的直接否定：取 $\varepsilon_0=1/2$，对任意 $N$ 选取 $n\ge N$ 与上面的 $x_n$ 即可。

还可考虑有尖峰的函数列，例如 $nx/(1+n^2x^2)$ 在 $[0,1]$ 上的峰值出现在 $x=1/n$，高度恒为 $1/2$。

**边界**：选择随 $n$ 变化的点不是在否定逐点极限；逐点极限始终先固定 $x$。`,['K03','K04'],['反例','构造']),
  k('K09','用统一上界证明一致收敛','method','寻找与 x 无关且趋于零的误差上界。',String.raw`# 统一估计是最常用的动作
若可以找到数列 $a_n\ge0$，使得
$$|f_n(x)-f(x)|\le a_n\quad(\forall x\in E),\qquad a_n\to0,$$
那么 $f_n\rightrightarrows f$。

::: proof
给定 $\varepsilon>0$，从 $a_n\to0$ 选 $N(\varepsilon)$，使 $n\ge N$ 时 $a_n<\varepsilon$。此 $N$ 与 $x$ 无关，故所有 $x\in E$ 都满足要求。
:::

::: example
$|\sin(nx)/n|\le1/n$ 对所有实数 $x$ 成立，所以 $\sin(nx)/n$ 在整个 $\mathbb R$ 上一致趋于零。
:::

**边界**：找到一个不趋零的粗糙上界，不能据此断言不一致收敛；也许存在更好的估计。`,['K02'],['估计','证明']),
  k('K10','定义域与局部一致收敛','concept','缩小定义域，可以把原本不统一的估计变统一。',String.raw`# 为什么区间改变结论也会改变？
一致收敛始终是相对于一个**固定的集合**而言的。

::: example
在 $[0,1)$ 上，$x^n$ 不一致趋零；但对任何固定的 $a<1$，在 $[0,a]$ 上有 $0\le x^n\le a^n\to0$，因此一致收敛。
:::

在靠近边界 $1$ 时，任何固定 $n$ 总还能找到很接近 $1$ 的 $x$ 使 $x^n$ 很大。把定义域限制在距离边界至少 $1-a>0$ 的区域，便消除了这种困难。

对非紧的定义域，还经常研究“在每一个紧子集上一致收敛”，这是**局部一致收敛**；它通常弱于在整个定义域上一致收敛。

**边界**：不能让定义域本身随 $n$ 改变，却不交代比较规则。标准的一致收敛定义要求所有 $f_n$ 在同一集合上讨论。`,['K02','K09'],['定义域','局部一致'])
]);

const m=(id,title,trigger,action,reason,boundary,knowledgeIds)=>({id:`ANA-UC-${id}`,title,trigger,action,reason,boundary,knowledgeIds:knowledgeIds.map(x=>`ANA-UC-${x}`)});
export const MATH_METHODS=Object.freeze([
  m('M01','量词展开与否定','题目要求证明定义或构造非一致收敛反例。',String.raw`写清 $\varepsilon,N,n,x$ 的顺序；反例需固定一个 $\varepsilon_0$，让任意 $N$ 都失败。`,'精确识别 $N$ 是否允许依赖 $x$。','固定一个“坏点”通常无法反驳已经逐点收敛的函数列。',['K02','K03']),
  m('M02','上确界转化','全定义域的误差可直接求上界或上确界。',String.raw`计算或估计 $e_n=\sup_{x\in E}|f_n-f|$，检查 $e_n\to0$。`,'把无穷多个点的误差转化为一个数列。','上确界可能不取到，也可能为无穷大。',['K04']),
  m('M03','移动点与尖峰反例','逐点极限成立，但误差集中在随 $n$ 移动的位置。',String.raw`构造 $x_n\in E$，使 $|f_n(x_n)-f(x_n)|\ge\varepsilon_0>0$。`,'它直接实现了一致收敛定义的逻辑否定。','必须先弄清真正的极限函数，不能让 $x_n$ 替代固定点的逐点检验。',['K03','K08']),
  m('M04','统一估计与夹逼','存在简单的与位置无关的上界。',String.raw`找 $|f_n(x)-f(x)|\le a_n$，其中 $a_n\to0$；从 $a_n$ 选择共同 $N$。`,'一个误差界同时控制整个定义域。','一个不趋零的上界不足以证明不一致收敛。',['K09']),
  m('M05','一致 Cauchy 尾项检验','极限函数难以直接写出，但函数列相邻或远端项便于比较。',String.raw`估计 $\sup_{x\in E}|f_n(x)-f_m(x)|$，使所有 $m,n\ge N$ 时足够小。`,'在完备值域中，一致 Cauchy 性等价于一致收敛。','需要同时控制任意两个尾项，不是只控制 $|f_{n+1}-f_n|$。',['K05'])
]);

const p=(number,title,type,difficulty,prompt,knowledge,methods,hints,solution,transfer)=>({
  id:`ANA-UC-P${String(number).padStart(2,'0')}`,title,type,difficulty,prompt,knowledgeIds:knowledge.map(x=>`ANA-UC-K${String(x).padStart(2,'0')}`),methodIds:methods.map(x=>`ANA-UC-M${String(x).padStart(2,'0')}`),hints,solution,transfer,
  courseId:'course-analysis-2',chapterId:'chapter-uniform',source:{kind:'original',attribution:'数学 · LMN 教学项目',license:'original'}
});
export const MATH_PROBLEMS=Object.freeze([
  p(1,'两种收敛的量词差别','概念辨析',1,String.raw`分别写出逐点收敛与一致收敛的 $\varepsilon$–$N$ 定义。解释哪一个量词顺序发生改变，以及为什么不能交换。`,[1,2,3],[1],['先想清 $N$ 是否允许依赖 $x$。',String.raw`比较 $\forall x\,\exists N$ 和 $\exists N\,\forall x$。`],String.raw`逐点：$\forall x\in E\,\forall\varepsilon>0\,\exists N(\varepsilon,x)\,\forall n\ge N:|f_n(x)-f(x)|<\varepsilon$。一致：$\forall\varepsilon>0\,\exists N(\varepsilon)\,\forall n\ge N\,\forall x\in E$，同一不等式成立。前者给每个点各自的起始位置；后者要求所有点共用一个起始位置。`,String.raw`用一句话否定一致收敛定义，并举出 $x^n$ 的证据。`),
  p(2,'经典反例：$x^n$ 在 $[0,1)$','反例构造',2,String.raw`证明 $f_n(x)=x^n$ 在 $[0,1)$ 上逐点趋零，但不一致趋零。请同时尝试定义法与上确界法。`,[1,2,3,4,8],[1,2,3],['对固定 $0\le x<1$，$x^n$ 的极限是什么？','取 $x_n=2^{-1/n}$，检查 $x_n^n$。','上确界 $\sup_{0\le x<1}x^n$ 是否随着 $n$ 缩小？'],String.raw`每个固定 $x<1$ 均有 $x^n\to0$。但 $\sup_{x\in[0,1)}x^n=1$，不趋零，故不一致收敛。或者取 $\varepsilon_0=1/2$、$x_n=2^{-1/n}\in[0,1)$，则任意 $n$ 都有 $x_n^n=1/2$，直接否定一致收敛的严格小于号。`,String.raw`若把定义域改为 $[0,a]$（$a<1$），还能构造这种反例吗？`),
  p(3,'限制定义域后的 $x^n$','证明训练',2,String.raw`固定 $0<a<1$。证明 $f_n(x)=x^n$ 在 $[0,a]$ 上一致收敛到零，并给出明确的 $N(\varepsilon)$。`,[2,4,9,10],[2,4],['先寻找对所有 $x\in[0,a]$ 成立的估计。','利用 $0\le x^n\le a^n$。'],String.raw`对 $x\in[0,a]$，有 $|x^n|\le a^n$，且 $a^n\to0$。对 $0<\varepsilon<1$，可取任意正整数 $N>\log\varepsilon/\log a$（由于 $\log a<0$），使 $n\ge N$ 时 $a^n<\varepsilon$；当 $\varepsilon\ge1$ 时取 $N=1$ 即可。`,String.raw`把 $[0,a]$ 改为 $[-a,a]$，估计需怎样修改？`),
  p(4,'闭区间上的不连续极限','概念证明',2,String.raw`求 $x^n$ 在 $[0,1]$ 上的逐点极限，并用连续性定理判断是否一致收敛。`,[1,2,6],[1],['注意 $x=1$ 时的值。','每个 $x^n$ 连续，但极限函数在 $1$ 处连续吗？'],String.raw`极限函数为 $f(x)=0$（$0\le x<1$）及 $f(1)=1$，在 $1$ 处不连续。若一致收敛，由连续函数列的一致极限定理，$f$ 也连续，矛盾。`,String.raw`如果不使用连续性定理，能用上确界直接判断吗？`),
  p(5,'乘上 $1/n$ 能否改善收敛？','统一估计',1,String.raw`判断 $f_n(x)=x^n/n$ 在 $[0,1]$ 上是否一致收敛于零。`,[2,4,9],[2,4],['上界 $0\le x^n\le1$。','误差的上确界是 $1/n$。'],String.raw`对所有 $x\in[0,1]$，$|x^n/n|\le1/n\to0$。所以 $f_n\rightrightarrows0$。事实上在 $x=1$ 取得上确界 $1/n$。`,String.raw`把 $1/n$ 换成任意正数列 $a_n\to0$，结果是否仍成立？`),
  p(6,'有界域与无界域的差别','定义域对比',2,String.raw`设 $f_n(x)=x/n$。分别讨论它在 $[0,1]$、$[-M,M]$（固定 $M>0$）和整个 $\mathbb R$ 上对零函数的收敛。`,[1,2,4,10],[2,4],['先固定一个 $x$。','在 $[-M,M]$ 上可用 $M/n$；在 $\mathbb R$ 上上确界是多少？'],String.raw`对所有固定 $x$ 都有 $x/n\to0$。在 $[0,1]$ 及 $[-M,M]$ 上分别有统一上界 $1/n$ 和 $M/n$，故一致收敛。在 $\mathbb R$ 上，每个 $n$ 都有 $\sup_{x\in\mathbb R}|x/n|=+\infty$，故不一致收敛。`,String.raw`在任意有界集合 $E\subset\mathbb R$ 上是否一致收敛？`),
  p(7,'移动尖峰：有理函数列','反例构造',3,String.raw`令 $f_n(x)=\dfrac{nx}{1+n^2x^2}$，$x\in[0,1]$。证明逐点收敛于零，但不一致收敛。`,[1,3,4,8],[2,3],['固定 $x>0$ 时分母增长更快。','试取 $x_n=1/n$。'],String.raw`$x=0$ 时 $f_n(0)=0$，固定 $x>0$ 时 $f_n(x)\sim1/(nx)\to0$。然而取 $x_n=1/n\in[0,1]$，有 $f_n(x_n)=1/2$，故不一致收敛。也可令 $t=nx$，利用 $t/(1+t^2)\le1/2$ 得到误差上确界恒为 $1/2$。`,String.raw`若定义域改为 $[\delta,1]$（$\delta>0$ 固定），结果如何？`),
  p(8,'真正有效的有理函数统一估计','统一估计',2,String.raw`证明 $f_n(x)=\dfrac{x}{1+nx}$ 在 $[0,1]$ 上一致收敛于零。`,[2,4,9],[2,4],['对固定 $n$，函数随 $x$ 增大如何变化？','上确界为 $1/(n+1)$。'],String.raw`由于 $x/(1+nx)$ 在 $[0,1]$ 上单调递增，有 $0\le f_n(x)\le1/(n+1)\to0$。给定 $\varepsilon>0$，选 $N>1/\varepsilon$，则任意 $n\ge N$ 与任意 $x\in[0,1]$ 都有 $|f_n(x)|\le1/(n+1)<\varepsilon$。故一致收敛于零。`,String.raw`若定义域换成 $[0,+\infty)$，上确界为多少？`),
  p(9,'正弦函数列的全实轴一致收敛','统一估计',1,String.raw`证明 $f_n(x)=\sin(nx)/n$ 在整个 $\mathbb R$ 上一致收敛于零。`,[2,9],[4],['$|\sin(nx)|\le1$ 对所有实数成立。'],String.raw`$\sup_{x\in\mathbb R}|\sin(nx)/n|=1/n\to0$。明确地，给定 $\varepsilon>0$，取整数 $N>1/\varepsilon$，则任意 $n\ge N$、$x\in\mathbb R$ 均满足 $|\sin(nx)/n|\le1/n<\varepsilon$。定义域虽无界，但误差界不依赖 $x$，所以一致收敛。`,String.raw`讨论 $g_n(x)=\sin(nx)/\sqrt n$。`),
  p(10,'$x^n(1-x)$：一个容易误判的例子','极值估计',3,String.raw`证明 $f_n(x)=x^n(1-x)$ 在 $[0,1]$ 上一致收敛于零。可以求极值，也可以给出简单统一上界。`,[2,4,9],[2,4],['对 $x\in[0,1]$，尝试求导。','临界点为 $x=n/(n+1)$。'],String.raw`$f_n'(x)=x^{n-1}[n-(n+1)x]$，故最大值出现在 $x=n/(n+1)$，等于 $\frac{n^n}{(n+1)^{n+1}}\le\frac1{n+1}\to0$。因此一致收敛。`,String.raw`如果定义域变为 $[0,1)$，一致收敛结论会改变吗？`),
  p(11,'连续性定理的证明','定理证明',4,String.raw`设 $f_n$ 在 $x_0$ 连续，且在 $E$ 上一致收敛于 $f$。请用三角不等式证明 $f$ 在 $x_0$ 连续。`,[2,6],[4],['分解 $f(x)-f(x_0)$，插入同一个 $f_n$。','先由一致收敛选 $n$，再由 $f_n$ 的连续性选 $\delta$。'],String.raw`给定 $\varepsilon>0$，一致收敛可选固定 $n$ 使 $\sup_{E}|f_n-f|<\varepsilon/3$。由 $f_n$ 在 $x_0$ 处连续，取 $\delta>0$，当 $x\in E$ 且 $|x-x_0|<\delta$ 时 $|f_n(x)-f_n(x_0)|<\varepsilon/3$。三角不等式三项合计小于 $\varepsilon$，故 $f$ 连续。`,String.raw`指出这个证明为什么不能只使用逐点收敛。`),
  p(12,'上确界不一定被取到','概念辨析',2,String.raw`求 $\sup_{x\in[0,1)}x^n$，说明是否存在使函数达到该值的点。由此判断是否一致收敛于零。`,[2,4],[2],['对任何 $x<1$，总有 $x^n<1$。','让 $x$ 无限接近 $1$。'],String.raw`每个 $n\ge1$，$x^n<1$（$x<1$），但取 $x\uparrow1$ 可任意逼近 $1$，故上确界为 $1$ 而无最大值。该上确界不趋零，故非一致收敛。`,String.raw`求 $\sup_{x\in(0,1)}x(1-x)$，它是否取到？`),
  p(13,'端点层：$1/(1+nx)$','不连续极限',3,String.raw`设 $f_n(x)=\dfrac1{1+nx}$，$x\in[0,1]$。找出逐点极限，并判断是否一致收敛。`,[1,2,6,8],[1,3],['单独检查 $x=0$。','固定 $x>0$ 时极限是什么？','极限函数在 $0$ 处是否连续？'],String.raw`在 $x=0$ 时恒为 $1$；固定 $x>0$ 时趋于 $0$。极限函数在 $0$ 不连续，但每个 $f_n$ 连续，故不一致收敛。也可取 $x_n=1/n$：$|f_n(x_n)-0|=1/2$。`,String.raw`把定义域换成 $[\delta,1]$，其中 $\delta>0$，如何证明一致收敛？`),
  p(14,'避开端点后恢复一致收敛','定义域对比',2,String.raw`固定 $0<\delta<1$，证明 $1/(1+nx)$ 在 $[\delta,1]$ 上一致收敛于零。`,[2,4,9,10],[2,4],['分母 $1+nx\ge1+n\delta$。'],String.raw`对所有 $x\in[\delta,1]$，有 $0<f_n(x)\le1/(1+n\delta)\to0$。具体地，给定 $\varepsilon>0$，选整数 $N>1/(\delta\varepsilon)$，那么对一切 $n\ge N$ 和所有 $x\in[\delta,1]$ 都有 $|f_n(x)|\le1/(1+n\delta)<\varepsilon$，故一致收敛。`,String.raw`这个结论可以推广到固定的 $[\delta,+\infty)$ 吗？`),
  p(15,'用一致 Cauchy 准则验证','Cauchy 判别',3,String.raw`不先给出极限函数，使用一致 Cauchy 准则证明 $f_n(x)=x/n$ 在 $[0,1]$ 上一致收敛。`,[5,9],[5],['估计 $|x/n-x/m|$。','可用 $|1/n-1/m|\le1/n+1/m$。'],String.raw`对任意 $m,n\ge N$、$x\in[0,1]$，有 $|f_n(x)-f_m(x)|\le1/n+1/m\le2/N$。取 $N>2/\varepsilon$ 即满足一致 Cauchy 条件。由实数的完备性知一致收敛。`,String.raw`它究竟收敛到哪个函数？现在再求出来。`),
  p(16,'用 Cauchy 准则否定一致收敛','Cauchy 反例',4,String.raw`不使用已知极限函数，用一致 Cauchy 准则证明 $x^n$ 在 $[0,1)$ 上不一致收敛。`,[3,5,8],[3,5],['选择尾项 $m=2n$。','取 $x_n=2^{-1/n}$。'],String.raw`对任意大的 $n$，在 $x_n=2^{-1/n}\in[0,1)$ 处，$|x_n^n-x_n^{2n}|=|1/2-1/4|=1/4$。取 $m=2n$，可让 $m,n$ 都超过任意指定的 $N$，却无法使尾项差小于 $1/4$，故不满足一致 Cauchy 条件。`,String.raw`把 $x^n$ 换为 $x^{2n}$，构造是否仍有效？`),
  p(17,'从一致收敛推导积分交换','定理应用',3,String.raw`假定 $f_n$ 在 $[a,b]$ Riemann 可积，一致收敛到 $f$。在已知 $f$ 可积的前提下，证明积分与极限可以交换，并说明该前提如何由一致收敛得到。`,[4,7],[2,4],['先对积分差使用三角不等式。','用区间长度乘上误差上确界。'],String.raw`一致极限的 Riemann 可积性由一致收敛与可积函数的一致逼近定理保证。然后 $|\int_a^b f_n-\int_a^b f|\le (b-a)\sup_{[a,b]}|f_n-f|\to0$，故积分交换。此估计是结论最直接的原因。`,String.raw`为什么把有界区间改为 $[0,+\infty)$ 后不能直接使用这一估计？`),
  p(18,'积分收敛不推出一致收敛','逆命题反例',2,String.raw`计算 $\int_0^1x^n\,dx$ 的极限。它能证明 $x^n$ 在 $[0,1]$ 上一致收敛吗？`,[4,6,7],[1,2],['积分是多少？','仍需考虑在 $x=1$ 的逐点极限。'],String.raw`$\int_0^1x^n\,dx=1/(n+1)\to0$，但 $x^n$ 在 $[0,1]$ 上并不一致收敛到逐点极限（后者在 $1$ 不连续）。所以积分收敛只说明某种平均累计误差很小，不能推出全域上确界误差趋零。`,String.raw`若 $f_n\ge0$ 且积分趋零，是否能保证逐点收敛？尝试构造反例。`),
  p(19,'一致收敛下的实际积分','计算与证明',2,String.raw`设 $f_n(x)=\sin x/n$，$x\in[0,\pi]$。先证明一致收敛，再计算 $\lim_n\int_0^{\pi}f_n(x)\,dx$。`,[7,9],[4],['统一估计 $|f_n|\le1/n$。','积分为 $2/n$。'],String.raw`$\sup_{x\in[0,\pi]}|f_n(x)|\le1/n\to0$，因此一致收敛于零。直接积分得 $\int_0^{\pi}\sin x/n\,dx=2/n\to0$，与逐项积分定理一致。`,String.raw`改用 $\cos x/n$ 是否仍然一致收敛？`),
  p(20,'综合比较：三种不同的统一控制','综合迁移',4,String.raw`分别判断函数列 $a_n(x)=x^n$（$E=[0,1)$）、$b_n(x)=x^n/n$（$E=[0,1)$）、$c_n(x)=x^n$（$E=[0,a]$，固定 $0<a<1$）是否一致趋零。为每个结论写出不同的有效原因。`,[1,2,3,4,8,9,10],[1,2,3,4],['分别计算三个误差上确界。','对 $a_n$ 的上确界为 $1$；另两者分别受 $1/n$ 和 $a^n$ 控制。'],String.raw`$a_n$ 逐点趋零但 $\sup_{[0,1)}|a_n|=1$，所以不一致；$b_n$ 满足 $\sup_{[0,1)}|b_n|=1/n\to0$，所以一致；$c_n$ 满足 $\sup_{[0,a]}|c_n|=a^n\to0$，所以一致。这表明函数列的增长方式和定义域的边界都会影响是否存在统一控制。`,String.raw`自己构造第四个函数列，在无界定义域上一致收敛。`)
]);

export const mathKnowledgeById=id=>MATH_KNOWLEDGE.find(x=>x.id===id)??null;
export const mathProblemById=id=>MATH_PROBLEMS.find(x=>x.id===id)??null;
export const mathMethodById=id=>MATH_METHODS.find(x=>x.id===id)??null;
export const mathCourseById=id=>MATH_COURSES.find(x=>x.id===id)??null;
export const mathProblemsForKnowledge=id=>MATH_PROBLEMS.filter(x=>x.knowledgeIds.includes(id));
export const mathProblemsForMethod=id=>MATH_PROBLEMS.filter(x=>x.methodIds.includes(id));
export function searchMathContent(items,{text='',difficulty='',type=''}={}){
  const query=String(text).trim().toLowerCase();return items.filter(item=>{
    if(difficulty&&String(item.difficulty)!==String(difficulty))return false;
    if(type&&item.type!==type)return false;
    const haystack=[item.id,item.title,item.summary,item.prompt,item.body,item.type,item.trigger,item.action,item.reason,item.boundary,...(item.tags??[])].filter(Boolean).join(' ').toLowerCase();
    return !query||haystack.includes(query);
  });
}
export function validateMathContent(){
  const all=[...MATH_COURSES,...MATH_KNOWLEDGE,...MATH_METHODS,...MATH_PROBLEMS],ids=new Set(all.map(x=>x.id)),issues=[];
  if(ids.size!==all.length)issues.push('发现重复 ID');
  for(const item of MATH_KNOWLEDGE){if(!item.body?.includes(':::')||!item.summary)issues.push(`${item.id} 正文不完整`);for(const id of item.prerequisites)if(!mathKnowledgeById(id))issues.push(`${item.id} 未知前置知识 ${id}`)}
  for(const item of MATH_PROBLEMS){if(!item.solution||!item.prompt||item.hints.length<1||!item.transfer)issues.push(`${item.id} 教学字段不完整`);for(const id of item.knowledgeIds)if(!mathKnowledgeById(id))issues.push(`${item.id} 未知知识 ${id}`);for(const id of item.methodIds)if(!mathMethodById(id))issues.push(`${item.id} 未知方法 ${id}`)}
  for(const item of MATH_METHODS)for(const id of item.knowledgeIds)if(!mathKnowledgeById(id))issues.push(`${item.id} 未知知识 ${id}`);
  for(const course of MATH_COURSES)for(const chapter of course.chapters){for(const id of chapter.knowledgeIds.map(x=>`ANA-UC-${x}`))if(!mathKnowledgeById(id))issues.push(`${chapter.id} 未知知识 ${id}`);for(const id of chapter.problemIds.map(x=>`ANA-UC-${x}`))if(!mathProblemById(id))issues.push(`${chapter.id} 未知题目 ${id}`)}
  const visited=new Set(),visiting=new Set();function walk(id){if(visiting.has(id)){issues.push(`${id} 前置知识成环`);return}if(visited.has(id))return;visiting.add(id);for(const dependency of mathKnowledgeById(id)?.prerequisites??[])walk(dependency);visiting.delete(id);visited.add(id)}for(const item of MATH_KNOWLEDGE)walk(item.id);
  return issues;
}
