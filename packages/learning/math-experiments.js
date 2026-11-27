export const EXPERIMENTS = [
  { id:'LAB-CYCLIC', title:'生成元与陪集', course:'近世代数', knowledgeId:'ALG-K02', problemId:'ALG-P02' },
  { id:'LAB-BERNOULLI', title:'条件概率与二项分布', course:'概率论', knowledgeId:'PROB-K01', problemId:'PROB-P01' },
  { id:'LAB-LOGISTIC', title:'Logistic 初值与稳定性', course:'常微分方程', knowledgeId:'ODE-K01', problemId:'ODE-P01' }
];

export const experimentById = id => EXPERIMENTS.find(item => item.id === id);
export const experimentFor = knowledgeId => EXPERIMENTS.find(item => item.knowledgeId === knowledgeId);

export function cyclicOrbit(n, g) {
  if (!Number.isInteger(n) || n < 2 || n > 128 || !Number.isInteger(g)) throw new RangeError('模数或生成元无效');
  g = ((g % n) + n) % n;
  let d = n, r = g;
  while (r) [d, r] = [r, d % r];
  const order = n / d;
  const orbit = Array.from({length:order}, (_, k) => k * g % n);
  return { order, index:d, orbit, cosets:Array.from({length:d}, (_, a) => orbit.map(b => (a + b) % n)) };
}

export function bernoulliLaw(n, p) {
  if (!Number.isInteger(n) || n < 1 || n > 32 || !Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('试验次数或概率无效');
  const distribution = [Math.pow(1-p,n)];
  let choose = 1;
  for (let k=1;k<=n;k++) {
    choose = choose * (n-k+1) / k;
    distribution.push(choose * p**k * (1-p)**(n-k));
  }
  const positive = p===1 ? 1 : -Math.expm1(n * Math.log1p(-p));
  return { distribution, positive, conditional:positive > 0 ? p / positive : null };
}

export const logisticSlope = (y,r) => r*y*(1-y);
export function logisticValue(t,y0,r) {
  const decay = Math.exp(-r*t);
  return y0 / (y0 + (1-y0)*decay);
}

