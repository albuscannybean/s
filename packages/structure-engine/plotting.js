const FUNCTIONS=Object.freeze({sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log,min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,round:Math.round});
const CONSTANTS=Object.freeze({pi:Math.PI,e:Math.E});

export const PLOT_PRESETS=Object.freeze({
  heart:{label:'心形线',source:'heart(scale=1, cx=0, cy=0)',range:[0,Math.PI*2]},
  cycloid:{label:'摆线',source:'cycloid(r=1, x0=-6, y0=0)',range:[0,Math.PI*4]},
  circle:{label:'圆',source:'circle(cx=0, cy=0, r=3)',range:[0,Math.PI*2]},
  ellipse:{label:'椭圆',source:'ellipse(cx=0, cy=0, a=4, b=2.5)',range:[0,Math.PI*2]},
  parabola:{label:'抛物线',source:'parabola(a=0.25, h=0, k=-2)',range:[-6,6]},
  helix:{label:'三维螺旋线',source:'helix(cx=0, cy=0, r=3, pitch=0.5)',range:[-Math.PI*2,Math.PI*2]},
  sphere:{label:'球面',source:'sphere(cx=0, cy=0, cz=0, r=2.5)'},
  torus:{label:'环面',source:'torus(cx=0, cy=0, cz=0, R=3, r=1)'},
  paraboloid:{label:'抛物面',source:'paraboloid(a=0.18, size=4)'}
});

const PRIMITIVES=Object.freeze({
  heart:{defaults:{scale:1,cx:0,cy:0},range:[0,Math.PI*2],build:p=>({x:`${p.cx}+${4*p.scale}*sin(t)^3`,y:`${p.cy}+${3*p.scale}*cos(t)-${1.2*p.scale}*cos(2*t)-${.5*p.scale}*cos(3*t)-${.2*p.scale}*cos(4*t)`})},
  cycloid:{defaults:{r:1,x0:-6,y0:0},range:[0,Math.PI*4],build:p=>({x:`${p.x0}+${p.r}*(t-sin(t))`,y:`${p.y0}+${p.r}*(1-cos(t))`})},
  circle:{defaults:{cx:0,cy:0,r:3},range:[0,Math.PI*2],build:p=>({x:`${p.cx}+${p.r}*cos(t)`,y:`${p.cy}+${p.r}*sin(t)`})},
  ellipse:{defaults:{cx:0,cy:0,a:4,b:2.5},range:[0,Math.PI*2],build:p=>({x:`${p.cx}+${p.a}*cos(t)`,y:`${p.cy}+${p.b}*sin(t)`})},
  parabola:{defaults:{a:.25,h:0,k:-2},range:[-6,6],kind:'function',build:p=>({y:`${p.a}*(x-${p.h})^2+${p.k}`})},
  helix:{defaults:{cx:0,cy:0,r:3,pitch:.5},range:[-Math.PI*2,Math.PI*2],build:p=>({x:`${p.cx}+${p.r}*cos(t)`,y:`${p.cy}+${p.r}*sin(t)`,z:`${p.pitch}*t`})},
  sphere:{defaults:{cx:0,cy:0,cz:0,r:2.5},kind:'surface',ranges:{u:[0,Math.PI*2],v:[0,Math.PI]},build:p=>({x:`${p.cx}+${p.r}*sin(v)*cos(u)`,y:`${p.cy}+${p.r}*sin(v)*sin(u)`,z:`${p.cz}+${p.r}*cos(v)`})},
  torus:{defaults:{cx:0,cy:0,cz:0,R:3,r:1},kind:'surface',ranges:{u:[0,Math.PI*2],v:[0,Math.PI*2]},build:p=>({x:`${p.cx}+(${p.R}+${p.r}*cos(v))*cos(u)`,y:`${p.cy}+(${p.R}+${p.r}*cos(v))*sin(u)`,z:`${p.cz}+${p.r}*sin(v)`})},
  paraboloid:{defaults:{a:.18,size:4},kind:'surface',rangesFrom:p=>({u:[-p.size,p.size],v:[-p.size,p.size]}),build:p=>({x:'u',y:'v',z:`${p.a}*(u^2+v^2)`})}
});

export function evaluateMathExpression(source,variables={}){
  const tokens=tokenize(source),parser=new Parser(tokens,variables),value=parser.expression();if(parser.peek().type!=='eof')throw new Error(`无法识别“${parser.peek().value}”`);if(!Number.isFinite(value))throw new Error('表达式结果不是有限数值');return value;
}

export function parsePlotExpression(source){
  const original=String(source??'').trim();if(!original)throw new Error('请输入表达式');if(PLOT_PRESETS[original.toLowerCase()]||Object.values(PLOT_PRESETS).some(item=>item.label===original))throw new Error(`预设图形需要显式参数，例如 ${PLOT_PRESETS[original.toLowerCase()]?.source??'circle(cx=0, cy=0, r=3)'}`);const primitive=parsePrimitive(original);if(primitive)return primitive;const assignments=Object.fromEntries(original.split(';').map(part=>part.trim()).filter(Boolean).map(part=>{const match=part.match(/^([xyz])\s*=\s*(.+)$/i);return match?[match[1].toLowerCase(),match[2]]:[null,null]}).filter(([key])=>key));if(assignments.x&&assignments.y)return{kind:'parametric',source:original,expressions:assignments,range:[-Math.PI*2,Math.PI*2],dimension:assignments.z?'3d':'2d'};const match=original.match(/^y\s*=\s*(.+)$/i);return{kind:'function',source:original,expressions:{y:match?.[1]??original},range:[-6,6],dimension:'2d'};
}

function parsePrimitive(source){
  const match=source.match(/^([a-z][a-z0-9_-]*)\s*\((.*)\)$/i);if(!match)return null;const name=match[1].toLowerCase(),definition=PRIMITIVES[name];if(!definition)throw new Error(`未知参数化图形 ${match[1]}`);const parameters={...definition.defaults},body=match[2].trim();if(body)for(const entry of splitArguments(body)){const pair=entry.trim().match(/^([a-z][a-z0-9_]*)\s*=\s*(.+)$/i);if(!pair)throw new Error(`参数“${entry.trim()}”需要使用 名称=数值`);const parameterKey=Object.keys(parameters).find(key=>key.toLowerCase()===pair[1].toLowerCase());if(!parameterKey)throw new Error(`${name} 不支持参数 ${pair[1]}`);parameters[parameterKey]=evaluateMathExpression(pair[2])}const expressions=definition.build(parameters),kind=definition.kind??'parametric',ranges=definition.rangesFrom?.(parameters)??definition.ranges;return{kind,source,expressions,range:definition.range??ranges?.u, ranges,dimension:expressions.z?'3d':'2d',primitive:{type:name,parameters}};
}

export function samplePlotExpression(source,{samples=240,range=null,ranges=null}={}){
  const parsed=parsePlotExpression(source);if(parsed.kind==='surface')return{...parsed,segments:sampleSurface({...parsed,ranges:ranges??parsed.ranges})};const[start,end]=range??parsed.range,points=[];for(let index=0;index<=samples;index++){const value=start+(end-start)*index/samples;try{points.push(safePoint(evaluatePlotPoint(parsed,value)))}catch{points.push(null)}}return{...parsed,segments:splitSegments(points)};
}

const SAMPLE_CACHE=new Map();
export function samplePlotExpressionCached(source,options={}){const key=JSON.stringify([String(source),Number(options.samples??240),options.range??null,options.ranges??null,options.quality??'full']);if(SAMPLE_CACHE.has(key))return SAMPLE_CACHE.get(key);const sampled=samplePlotExpression(source,options);SAMPLE_CACHE.set(key,sampled);if(SAMPLE_CACHE.size>180)SAMPLE_CACHE.delete(SAMPLE_CACHE.keys().next().value);return sampled}
export function clearPlotSampleCache(source=null){if(source==null)return SAMPLE_CACHE.clear();for(const key of SAMPLE_CACHE.keys())if(key.startsWith(`[${JSON.stringify(String(source))},`))SAMPLE_CACHE.delete(key)}

export function evaluatePlotPoint(sourceOrParsed,t){const parsed=typeof sourceOrParsed==='string'?parsePlotExpression(sourceOrParsed):sourceOrParsed;if(parsed.kind==='surface')throw new Error('曲面不能作为单参数动点轨迹');return parsed.kind==='function'?{x:t,y:evaluateMathExpression(parsed.expressions.y,{x:t,t}),z:0}:{x:evaluateMathExpression(parsed.expressions.x,{t,x:t}),y:evaluateMathExpression(parsed.expressions.y,{t,x:t}),z:parsed.expressions.z?evaluateMathExpression(parsed.expressions.z,{t,x:t}):0}}

export function numericalDerivative(source,x,h=1e-4){const parsed=parsePlotExpression(source);if(parsed.kind!=='function')throw new Error('导数仅适用于 y=f(x)');return(evaluateMathExpression(parsed.expressions.y,{x:x+h})-evaluateMathExpression(parsed.expressions.y,{x:x-h}))/(2*h)}
export function numericalIntegral(source,a,b,steps=800){const parsed=parsePlotExpression(source);if(parsed.kind!=='function')throw new Error('定积分仅适用于 y=f(x)');const n=Math.max(2,Math.round(steps/2)*2),h=(b-a)/n;let sum=evaluateMathExpression(parsed.expressions.y,{x:a})+evaluateMathExpression(parsed.expressions.y,{x:b});for(let index=1;index<n;index++)sum+=(index%2?4:2)*evaluateMathExpression(parsed.expressions.y,{x:a+index*h});return sum*h/3}
export function numericalLimit(source,x,direction='both',h=1e-5){const parsed=parsePlotExpression(source);if(parsed.kind!=='function')throw new Error('极限仅适用于 y=f(x)');const left=evaluateMathExpression(parsed.expressions.y,{x:x-h}),right=evaluateMathExpression(parsed.expressions.y,{x:x+h});if(direction==='left')return left;if(direction==='right')return right;if(Math.abs(left-right)>Math.max(1e-4,Math.abs(left+right)*1e-4))throw new Error(`左右极限不一致：${left.toPrecision(6)} / ${right.toPrecision(6)}`);return(left+right)/2}
export function numericalSeries(source,start,end){const expression=String(source??'').replace(/^\s*y\s*=\s*/i,''),from=Math.ceil(start),to=Math.floor(end);if(to<from||to-from>100000)throw new Error('级数范围无效或过大');let sum=0;for(let n=from;n<=to;n++)sum+=evaluateMathExpression(expression,{n,x:n});return sum}

function sampleSurface(parsed){const ranges=parsed.ranges??{u:[-3,3],v:[-3,3]},steps=18,segments=[],point=(u,v)=>safePoint({x:evaluateMathExpression(parsed.expressions.x,{u,v}),y:evaluateMathExpression(parsed.expressions.y,{u,v}),z:evaluateMathExpression(parsed.expressions.z,{u,v})});for(let row=0;row<=steps;row++){const u=ranges.u[0]+(ranges.u[1]-ranges.u[0])*row/steps,line=[];for(let col=0;col<=steps*2;col++){const v=ranges.v[0]+(ranges.v[1]-ranges.v[0])*col/(steps*2);line.push(point(u,v))}segments.push(...splitSegments(line))}for(let col=0;col<=steps;col++){const v=ranges.v[0]+(ranges.v[1]-ranges.v[0])*col/steps,line=[];for(let row=0;row<=steps*2;row++){const u=ranges.u[0]+(ranges.u[1]-ranges.u[0])*row/(steps*2);line.push(point(u,v))}segments.push(...splitSegments(line))}return segments}
function safePoint(point){return[point.x,point.y,point.z].every(Number.isFinite)&&Math.max(Math.abs(point.x),Math.abs(point.y),Math.abs(point.z))<1e4?point:null}
function splitArguments(source){const entries=[];let depth=0,start=0;for(let index=0;index<source.length;index++){if(source[index]==='(')depth++;if(source[index]===')')depth--;if(source[index]===','&&!depth){entries.push(source.slice(start,index));start=index+1}}entries.push(source.slice(start));return entries.filter(value=>value.trim())}

function splitSegments(points){const result=[];let current=[];for(const point of points){if(point)current.push(point);else if(current.length){result.push(current);current=[]}}if(current.length)result.push(current);return result}
function tokenize(source){const result=[];let index=0,text=String(source).toLowerCase();while(index<text.length){const char=text[index];if(/\s/.test(char)){index++;continue}const number=text.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/);if(number){result.push({type:'number',value:Number(number[0])});index+=number[0].length;continue}const name=text.slice(index).match(/^[a-z_][a-z0-9_]*/);if(name){result.push({type:'name',value:name[0]});index+=name[0].length;continue}if('+-*/^(),'.includes(char)){result.push({type:char,value:char});index++;continue}throw new Error(`不支持的字符“${char}”`)}result.push({type:'eof',value:''});return result}
class Parser{
  constructor(tokens,variables){this.tokens=tokens;this.index=0;this.variables=variables}
  peek(){return this.tokens[this.index]}
  take(type){const token=this.peek();if(token.type!==type)throw new Error(`需要 ${type}`);this.index++;return token}
  expression(min=0){let left=this.prefix();while(true){const token=this.peek(),precedence={'+':1,'-':1,'*':2,'/':2,'^':3}[token.type]??-1;if(precedence<min)break;this.index++;const right=this.expression(precedence+(token.type==='^'?0:1));left=token.type==='+'?left+right:token.type==='-'?left-right:token.type==='*'?left*right:token.type==='/'?left/right:left**right}return left}
  prefix(){const token=this.peek();if(token.type==='+'||token.type==='-'){this.index++;const value=this.expression(4);return token.type==='-'?-value:value}if(token.type==='number'){this.index++;return token.value}if(token.type==='('){this.index++;const value=this.expression();this.take(')');return value}if(token.type==='name'){this.index++;const name=token.value;if(this.peek().type==='('){this.index++;const args=[];if(this.peek().type!==')'){do{args.push(this.expression())}while(this.peek().type===','&&(this.index++,true))}this.take(')');if(!FUNCTIONS[name])throw new Error(`不支持函数 ${name}`);return FUNCTIONS[name](...args)}if(name in this.variables)return Number(this.variables[name]);if(name in CONSTANTS)return CONSTANTS[name];throw new Error(`未知变量 ${name}`)}throw new Error(`无法解析“${token.value}”`)}
}
