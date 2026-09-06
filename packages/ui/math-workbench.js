import {parseMatrix,matrixOperation,formatMatrix,parseVector,vectorOperation} from '../math/linear-algebra.js';
import {PLOT_PRESETS,evaluateMathExpression,parsePlotExpression,samplePlotExpression,numericalDerivative,numericalIntegral,numericalLimit,numericalSeries} from '../structure-engine/plotting.js';

const element=(root,tag,text='',className='')=>{const el=root.ownerDocument.createElement(tag);el.textContent=text;el.className=className;return el;};
const field=(root,label,value='',kind='input')=>{const wrap=element(root,'label',label),input=element(root,kind);input.value=value;input.setAttribute('aria-label',label);wrap.append(input);root.append(wrap);return input;};
const select=(root,label,items)=>{const control=field(root,label,'','select');for(const[value,text]of items){const option=element(root,'option',text);option.value=value;control.append(option);}return control;};
const action=(root,label,run)=>{const button=element(root,'button',label);button.type='button';button.onclick=run;root.append(button);return button;};
const number=source=>evaluateMathExpression(String(source));
const show=(output,run)=>{try{const value=run();output.classList.remove('error');output.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);return value;}catch(error){output.classList.add('error');output.textContent=error.message;return undefined;}};

export function mountMatrixWorkbench(root,{matrix=null,onApply=()=>{}}={}) {
  const panel=element(root,'section','','math-workbench matrix-workbench');root.append(panel);
  panel.append(element(root,'h3','矩阵运算'),element(root,'p','每行一行，元素用空格或逗号分隔。支持 pi、e 和算术表达式。'));
  const form=element(root,'div','','math-form');panel.append(form);
  const a=field(form,'矩阵 A',matrix?formatMatrix(matrix):'1 2\n3 4','textarea'),b=field(form,'矩阵 B / 右端项','1 0\n0 1','textarea');
  const op=select(form,'运算',[['transpose','Aᵀ · 转置'],['add','A + B'],['subtract','A − B'],['multiply','AB · 乘法'],['determinant','det(A) · 行列式'],['inverse','A⁻¹ · 逆矩阵'],['rank','rank(A) · 秩'],['rref','rref(A) · 行最简形'],['solve','AX = B · 求唯一解']]);
  const actions=element(root,'div','','math-actions'),output=element(root,'output','输入矩阵后计算。','math-result');form.append(actions,output);output.setAttribute('aria-live','polite');
  let result=null;
  action(actions,'计算',()=>{const value=show(output,()=>{result=matrixOperation(op.value,parseMatrix(a.value),['add','subtract','multiply','solve'].includes(op.value)?parseMatrix(b.value):null);return formatMatrix(result);});if(value===undefined)result=null;});
  action(actions,'将 A 写入当前矩阵',()=>show(output,()=>{const m=parseMatrix(a.value);onApply(m);return '矩阵已更新';}));
  action(actions,'将结果写入当前矩阵',()=>show(output,()=>{if(!Array.isArray(result))throw new Error('请先计算一个矩阵结果。');onApply(result);return '结果已写入矩阵';}));
  panel.append(element(root,'small','采用双精度数值计算与主元消元。病态矩阵的结果需结合数值尺度判断。','math-hint'));
  return panel;
}

export function mountMathWorkbench(root,context) {
  const {instance,dimension='2d',onDimension,onPoint,onVector,onBasis,onPlot,onGeometry,geometryAvailability={},geometrySummary='',onMode,mode='geometry'}=context;
  const panel=element(root,'section','','math-workbench coordinate-operation-workbench');root.append(panel);
  const tabs=element(root,'nav','','math-tabs coordinate-operation-switch');panel.append(tabs);
  for(const[key,label]of [['geometry','几何'],['algebra','代数']]){const button=action(tabs,label,()=>onMode(key));button.classList.toggle('active',mode===key);}
  if(mode==='geometry') {
    const space=element(root,'div','','math-tabs plot-dimension');space.append(element(root,'b','坐标空间'));for(const[key,label]of [['2d','二维'],['3d','三维']]){const b=action(space,label,()=>onDimension(key));b.classList.toggle('active',dimension===key);}panel.append(space);
    const section=element(root,'section','','math-form coordinate-operation-section');panel.append(section);
    section.append(element(root,'h3','定义几何对象'));
    const kind=select(section,'对象类型',[['plot','函数、曲线或曲面'],['point','点'],['vector','向量']]);
    const name=field(section,'对象名称',''),expression=field(section,'表达式','y=sin(x)','textarea');
    expression.id='plotExpressionInput';
    const domains=element(root,'div','','math-field-grid');section.append(domains);
    const start=field(domains,'参数起点','-6'),end=field(domains,'参数终点','6'),vstart=field(domains,'曲面第二参数起点','-6'),vend=field(domains,'曲面第二参数终点','6');
    const presets=element(root,'div','','math-tabs plot-presets');section.append(presets);
    for(const p of Object.values(PLOT_PRESETS))action(presets,p.label,()=>{kind.value='plot';expression.value=p.source;const parsed=parsePlotExpression(p.source);[start.value,end.value]=parsed.range??parsed.ranges?.u??[-6,6];[vstart.value,vend.value]=parsed.ranges?.v??[-6,6];});
    kind.onchange=()=>{expression.value=kind.value==='plot'?'y=sin(x)':dimension==='3d'?'1, 2, 3':'1, 2';domains.hidden=presets.hidden=kind.value!=='plot';};
    section.append(element(root,'small','函数 y=sin(x)；曲面 z=x^2+y^2；参数曲线 x=cos(t); y=sin(t)；参数曲面 x=u; y=v; z=u*v。点和向量输入坐标。','math-hint'));
    const output=element(root,'output','对象定义后会进入统一变量表。','math-result'),actions=element(root,'div','','math-actions');section.append(actions,output);
    action(actions,'创建对象',()=>show(output,()=>{
      if(kind.value==='point'||kind.value==='vector'){const p=parseVector(expression.value);if(p.length!==(dimension==='3d'?3:2))throw new Error('坐标数量须与空间维数相同。');(kind.value==='point'?onPoint:onVector)(name.value||undefined,...p, ...(p.length===2?[0]:[]));return '已创建';}
      const parsed=parsePlotExpression(expression.value),a=number(start.value),b=number(end.value),c=number(vstart.value),d=number(vend.value);
      if(a>=b||c>=d)throw new Error('参数起点必须小于终点。');
      const sample=samplePlotExpression(parsed.source,{samples:80,range:[a,b],ranges:{u:[a,b],v:[c,d]}});
      if(!sample.segments.length)throw new Error('表达式在该范围没有可绘制的实数点。');
      onPlot({source:parsed.source,label:name.value||parsed.source,range:[a,b],ranges:{u:[a,b],v:[c,d]},dimension:parsed.dimension});[...space.querySelectorAll('button')].forEach((button,i)=>button.classList.toggle('active',(i===0?'2d':'3d')===parsed.dimension));return '已创建 '+(parsed.kind==='surface'?'曲面':'曲线');
    }));
    action(actions,'添加标准基',()=>show(output,()=>{onBasis();return '已添加标准基';}));
    const construction=element(root,'section','','coordinate-operation-section math-form');construction.append(element(root,'h3','几何构造与测量'),element(root,'p','Shift 选择画布对象后构造；依赖对象变化时重新计算。'),element(root,'small',geometrySummary||'当前尚未选择操作数。'));panel.append(construction);
    for(const[key,label]of [['line','连接直线'],['area','计算面积'],['volume','计算体积']]){const b=action(construction,label,()=>onGeometry(key));b.disabled=!geometryAvailability[key];b.title=geometryAvailability.reasons?.[key]??label;}
  } else {
    const calculus=element(root,'section','','math-form coordinate-operation-section');panel.append(calculus);calculus.append(element(root,'h3','函数与数值分析'));
    const expression=field(calculus,'函数 f(x)',(instance.plotExpressions??[]).find(p=>{try{return parsePlotExpression(p.source).kind==='function';}catch{return false;}})?.source??'y=sin(x)');
    const op=select(calculus,'计算项目',[['value','f(x) · 函数值'],['derivative',"f′(x) · 数值导数"],['integral','∫ f(x) dx · 定积分'],['limit','lim f(x) · 数值极限估计'],['series','Σ f(k) · 有限部分和']]);
    const grid=element(root,'div','','math-field-grid');calculus.append(grid);
    const x=field(grid,'x / 趋近点','0'),a=field(grid,'积分下限 / 求和起点','0'),b=field(grid,'积分上限 / 求和终点','1');
    const output=element(root,'output','计算结果会显示数值近似。','math-result');output.id='plotAnalysisResult';
    action(calculus,'计算',()=>show(output,()=>{const parsed=parsePlotExpression(expression.value);if(parsed.kind!=='function')throw new Error('请选择单变量函数。');let result;
      if(op.value==='value')result=evaluateMathExpression(parsed.expressions.y,{x:number(x.value)});
      if(op.value==='derivative')result=numericalDerivative(parsed.source,number(x.value));
      if(op.value==='integral')result=numericalIntegral(parsed.source,number(a.value),number(b.value));
      if(op.value==='limit')result=numericalLimit(parsed.source,number(x.value));
      if(op.value==='series'){const first=number(a.value),last=number(b.value);if(!Number.isInteger(first)||!Number.isInteger(last)||last<first||last-first>10000)throw new Error('求和上下限须为递增整数，最多 10001 项。');result=numericalSeries(parsed.source,first,last);}
      if(!Number.isFinite(result))throw new Error('未得到有限结果。');return '≈ '+Number(result.toPrecision(12));
    }));calculus.append(output,element(root,'small','数值估计不构成极限存在或级数收敛的证明。','math-hint'));
    const vectors=element(root,'section','','math-form coordinate-operation-section');panel.append(vectors);vectors.append(element(root,'h3','向量代数'));
    const va=field(vectors,'向量 a','1, 0, 0'),vb=field(vectors,'向量 b','0, 1, 0'),vop=select(vectors,'向量运算',[['add','a + b'],['dot','a · b'],['cross','a × b'],['norm','‖a‖'],['unit','a / ‖a‖'],['angle','夹角（弧度）'],['projection','a 在 b 上的正交投影'],['distance','两点距离']]),vout=element(root,'output','输入坐标后计算。','math-result');
    action(vectors,'计算向量',()=>show(vout,()=>{const value=vectorOperation(vop.value,parseVector(va.value),['norm','unit'].includes(vop.value)?null:parseVector(vb.value));return Array.isArray(value)?'('+value.map(x=>Number(x.toPrecision(10))).join(', ')+')':String(Number(value.toPrecision(12)));}));vectors.append(vout);
  }
  return panel;
}
