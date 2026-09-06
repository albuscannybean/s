import {evaluateMathExpression} from '../structure-engine/plotting.js';

export function parseMatrix(text) {
  const rows=String(text).trim().replace(/^\s*\[/,'').replace(/\]\s*$/,'').split(/[\n;]/).filter(s=>s.trim()).map(row=>row.trim().replace(/^\[|\]$/g,'').split(/[\s,]+/).filter(Boolean).map(s=>evaluateMathExpression(s)));
  return validateMatrix(rows);
}
export function validateMatrix(matrix) {
  if(!Array.isArray(matrix)||!matrix.length||matrix.length>20||!Array.isArray(matrix[0])||!matrix[0].length||matrix[0].length>20)throw new Error('矩阵需要 1–20 行、1–20 列。');
  const n=matrix[0].length;
  if(matrix.some(row=>!Array.isArray(row)||row.length!==n||row.some(x=>typeof x!=='number'||!Number.isFinite(x))))throw new Error('每行列数必须相同，元素必须是有限实数。');
  return matrix.map(row=>[...row]);
}
export const transpose=A=>validateMatrix(A)[0].map((_,j)=>A.map(row=>row[j]));
export function add(A,B,scale=1) {
  A=validateMatrix(A);B=validateMatrix(B);
  if(A.length!==B.length||A[0].length!==B[0].length)throw new Error('相加减的矩阵必须同型。');
  return A.map((row,i)=>row.map((x,j)=>x+scale*B[i][j]));
}
export function multiply(A,B) {
  A=validateMatrix(A);B=validateMatrix(B);
  if(A[0].length!==B.length)throw new Error('A 的列数必须等于 B 的行数。');
  return A.map(row=>B[0].map((_,j)=>row.reduce((sum,x,k)=>sum+x*B[k][j],0)));
}
function eliminate(A,B=null) {
  A=validateMatrix(A);const columns=A[0].length;
  if(B){B=validateMatrix(B);if(B.length!==A.length)throw new Error('右端项与 A 的行数必须相同。');}
  const out=A.map((row,i)=>[...row,...(B?.[i]??[])]),pivots=[],scale=Math.max(...A.flat().map(Math.abs)),epsilon=scale*Number.EPSILON*Math.max(A.length,columns)*32;
  let determinant=1,row=0;
  for(let col=0;col<columns&&row<out.length;col++){
    let selected=row;for(let r=row+1;r<out.length;r++)if(Math.abs(out[r][col])>Math.abs(out[selected][col]))selected=r;
    if(Math.abs(out[selected][col])<=epsilon)continue;
    if(selected!==row){[out[row],out[selected]]=[out[selected],out[row]];determinant*=-1;}
    const pivot=out[row][col];determinant*=pivot;
    out[row]=out[row].map(x=>x/pivot);
    for(let r=0;r<out.length;r++)if(r!==row){const factor=out[r][col];out[r]=out[r].map((x,j)=>j===col?0:x-factor*out[row][j]);}
    pivots.push(col);row++;
  }
  if(out.flat().some(x=>!Number.isFinite(x)))throw new Error('数值溢出或矩阵严重病态，请调整数值尺度。');
  return {matrix:out,pivots,rank:row,determinant:row===columns?determinant:0};
}
export const rref=A=>eliminate(A).matrix;
export const rank=A=>eliminate(A).rank;
const square=A=>{A=validateMatrix(A);if(A.length!==A[0].length)throw new Error('该运算要求方阵。');return A;};
export const determinant=A=>eliminate(square(A)).determinant;
export function inverse(A) {
  A=square(A);const n=A.length,result=eliminate(A,Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j))));
  if(result.rank!==n)throw new Error('矩阵奇异或在当前数值精度下不可逆。');
  return result.matrix.map(row=>row.slice(n));
}
export function solve(A,B) {
  A=validateMatrix(A);B=validateMatrix(B);const n=A[0].length,result=eliminate(A,B);
  const rhsScale=Math.max(...B.flat().map(Math.abs)),rhsTolerance=rhsScale*Number.EPSILON*Math.max(A.length,n)*64;
  if(result.matrix.slice(result.rank).some(row=>row.slice(n).some(x=>Math.abs(x)>rhsTolerance)))throw new Error('方程组不相容，无解。');
  if(result.rank<n)throw new Error('方程组有自由变量，无唯一解。请查看增广矩阵的行最简形。');
  return result.matrix.slice(0,n).map(row=>row.slice(n));
}
export function matrixOperation(operation,A,B) {
  const fn={transpose,rref,rank,determinant,inverse,add,subtract:(a,b)=>add(a,b,-1),multiply,solve}[operation];
  if(!fn)throw new Error('未知矩阵运算');const result=fn(A,B);
  if((Array.isArray(result)?result.flat():[result]).some(x=>!Number.isFinite(x)))throw new Error('运算超出有限数值范围。');
  return result;
}
export function formatMatrix(value) {return Array.isArray(value)?value.map(row=>row.map(x=>Number(x.toPrecision(10))).join('\t')).join('\n'):String(Number(value.toPrecision(10)));}
export function parseVector(text) {const vector=String(text).trim().replace(/^[([]|[)\]]$/g,'').split(/[\s,]+/).filter(Boolean).map(x=>evaluateMathExpression(x));if(![2,3].includes(vector.length))throw new Error('向量需要 2 或 3 个坐标。');return vector;}
export function vectorOperation(op,a,b) {
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a);
  if(op==='norm')return norm(a);if(op==='unit'){if(!norm(a))throw new Error('零向量没有单位方向。');return a.map(x=>x/norm(a));}
  if(a.length!==b?.length)throw new Error('两个向量的维数必须相同。');
  if(op==='dot')return dot(a,b);
  if(op==='cross'){if(a.length!==3)throw new Error('叉积需要三维向量。');return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  if(op==='angle'){if(!norm(a)||!norm(b))throw new Error('零向量不能定义夹角。');return Math.acos(Math.max(-1,Math.min(1,dot(a,b)/norm(a)/norm(b))));}
  if(op==='projection'){const d=dot(b,b);if(!d)throw new Error('不能投影到零向量。');return b.map(x=>x*dot(a,b)/d);}
  if(op==='distance')return norm(a.map((x,i)=>x-b[i]));
  if(op==='add')return a.map((x,i)=>x+b[i]);
  throw new Error('未知向量运算');
}
