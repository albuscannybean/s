// Mathematical models are independent of UI, authoring agents and persistence.
import {NUMBERING_PARAMETERS} from './structure-families.js';
import {formatSequenceName} from '../domain/naming-policy.js';
const param=(id,label,defaultValue,type='string',extra={})=>({id,label,defaultValue,type,...extra});
const node=(id,label,role='element',extra={})=>({id,label,role,semanticCoordinate:{},accepts:['knowledge','structure','value','variable'],cardinality:'many',...extra});
const edge=(id,from,to,label='',type='maps-to',direction='directed')=>({id,sourceSlotId:from,targetSlotId:to,label,relationType:type,direction,routing:'straight'});
const spec=(id,name,description,parameters,affordances)=>({id:'builtin:'+id,name,description,version:4,category:({'n-center':'graph','function-mapping':'algebra','commutative-diagram':'algebra','equivalence-classes':'set','set-partition':'set','cartesian-product':'set','permutation':'algebra','transformation-group':'geometry','dynamical-system':'analysis','flow-network':'graph'}[id]??'graph'),maturity:'ready',builtin:true,nestable:true,computable:true,parameterized:!!parameters.length,slotFactory:'semantic:'+id,slots:[],edges:[],parameters,variables:[],constraints:[],rules:[],layout:{type:'manual'},viewCapability:{mode:'fixed',label:'语义布局'},capability:{affordances,ordering:id==='n-center'?'unordered':'model-defined',evidenceRequired:true},visual:{accent:'#2f7658'}});
export const SEMANTIC_TEMPLATES=[
 {...spec('n-center','n 元中心 · Center & Facets','一个中心与无序的并列面向。圆周位置不表示先后、依赖或等级。',[param('nodeCount','外围节点数量',4,'number',{min:1,max:60,labelI18n:{'zh-CN':'外围节点数量',en:'Peripheral nodes'}}),param('members','面向名称（逗号分隔，可留空）','', 'string',{labelI18n:{'zh-CN':'面向名称（逗号分隔，可留空）',en:'Facet labels (comma separated, optional)'}}),...NUMBERING_PARAMETERS.map(p=>p.id==='numbering'?{...p,defaultValue:'none'}:p),param('centerLabel','中心名称','中心','string',{labelI18n:{'zh-CN':'中心名称',en:'Center label'}})],['center-periphery','unordered-facets','overview']),version:5,computable:false,family:{id:'center-facets',invariants:['one-center','unordered-facets']}},
 spec('function-mapping','函数映射 · Function Mapping','有限集合间的函数：定义域每个元素恰有一个像；自动检验单射、满射。',[param('domain','定义域','a,b,c'),param('codomain','陪域','1,2'),param('images','按定义域顺序列出的像','1,2,1')],['mapping','finite-function']),
 spec('commutative-diagram','交换图 · Commutative Diagram','四个有限集上的映射方形；逐元素验证 h∘f = k∘g。映射用 0…n−1 的像列表定义。',[param('f','f: A → B','0,1,2'),param('g','g: A → C','0,1,2'),param('h','h: B → D','0,1,2'),param('k','k: C → D','0,1,2')],['mapping','composition','commutativity']),
 spec('equivalence-classes','等价类 · Equivalence Classes','同一分组内的元素等价；各等价类互斥，组成商集。每个元素只能属于一个类。',[param('groups','等价类（类内逗号，类间 |）','a,b|c,d|e')],['equivalence','quotient-set']),
 spec('set-partition','集合划分 · Set Partition','非空、两两不交的子集，其并集就是当前全集。',[param('groups','分块（块内逗号，块间 |）','a,b|c,d|e')],['partition','disjoint-subsets']),
 spec('cartesian-product','笛卡尔积 · Cartesian Product','A×B 的每一个有序对；行对应 A，列对应 B，不添加虚假的时间或依赖箭头。',[param('setA','集合 A','a,b'),param('setB','集合 B','1,2,3')],['ordered-pairs','cartesian-product','matrix']),
 spec('permutation','置换 · Permutation','有限集上的双射，显示真实置换箭头与不交循环分解。',[param('images','σ(1),…,σ(n)','2,3,1,4')],['bijection','permutation','cycles']),
 spec('transformation-group','变换群 · Dihedral Action','正 n 边形的二面体群 Dₙ：n 个旋转和 n 个反射。图表示右乘旋转 r 与反射 s 的 Cayley 作用。',[param('n','多边形边数 n',3,'number',{min:3,max:8})],['group-action','symmetry','cayley-graph']),
 spec('dynamical-system','动力系统 · Discrete Dynamics','Logistic 映射 xₖ₊₁ = r xₖ(1−xₖ) 的有限轨道，显示由参数计算出的实际状态。',[param('r','参数 r',3.2,'number',{min:0,max:4}),param('x0','初态 x₀',0.2,'number',{min:0,max:1}),param('steps','迭代步数',8,'number',{min:1,max:30})],['state-evolution','iteration']),
 spec('flow-network','流网络 · Flow Network','有向容量网络，计算 s→t 最大流；边标注容量上界。每条边一行：起点,终点,容量。',[param('arcs','容量边','s,a,5;a,t,3;s,t,1')],['flow','capacity','conservation']),
];
const split=value=>String(value).split(',').map(x=>x.trim()).filter(Boolean);
const unique=(xs,label)=>{if(!xs.length||xs.length>30||new Set(xs).size!==xs.length)throw new Error(label+'须有 1–30 个互不重复的元素。');return xs;};
const place=(slots,positions)=>({type:'manual',positions:Object.fromEntries(slots.map((s,i)=>[s.id,{x:positions[i][0],y:positions[i][1],width:positions[i][2]??190,height:positions[i][3]??100}]))});
export function materializeSemanticTemplate(template,parameters={}) {
 if(!template.slotFactory?.startsWith('semantic:'))return null;
 const id=template.slotFactory.slice('semantic:'.length),p={...Object.fromEntries(template.parameters.map(x=>[x.id,x.defaultValue])),...parameters};
 let slots=[],edges=[],positions=[],description=template.description,info={};
 const add=(label,role,x,y,extra={})=>{const s=node(id+'-'+(slots.length+1),label,role,extra);slots.push(s);positions.push([x,y]);return s.id;};
 if(id==='n-center') {
  const labels=String(p.members??'').split(/[,，\n]/).map(s=>s.trim()),hasLabels=labels.some(Boolean),n=Number(Object.hasOwn(parameters,'nodeCount')?parameters.nodeCount:hasLabels?labels.length:p.nodeCount);
  if(!Number.isInteger(n)||n<1||n>60)throw new Error('外围节点数量须为 1–60 的整数。');
  if(hasLabels&&labels.length>n)throw new Error('面向标签数量不能超过外围节点数量。');
  const radius=Math.max(290,n*42),cx=radius+150,cy=radius+120;
  add(String(p.centerLabel??'中心'),'host-anchor',cx,cy,{hostAnchor:true});
  Array.from({length:n},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n,label=formatSequenceName(i,{style:p.numbering,format:p.numberFormat,start:p.numberStart,label:labels[i]??''}),target=add(label,'facet',cx+radius*Math.cos(a),cy+radius*Math.sin(a),{semanticCoordinate:{facetIndex:i,angle:360*i/n}});edges.push(edge('facet-'+i,slots[0].id,target,'','facet-membership','undirected'));});
  info={ordering:'unordered',hostAnchorSlot:slots[0].id,facetCount:n,naming:{style:p.numbering,format:p.numberFormat,start:p.numberStart}};template={...template,parameters:template.parameters.map(parameter=>parameter.id==='nodeCount'?{...parameter,defaultValue:n}:parameter),capability:{...template.capability,ordering:'unordered'}};
 } else if(id==='function-mapping') {
  const domain=unique(split(p.domain),'定义域'),codomain=unique(split(p.codomain),'陪域'),images=split(p.images);
  if(images.length!==domain.length||images.some(v=>!codomain.includes(v)))throw new Error('每个定义域元素须恰有一个属于陪域的像。');
  const left=domain.map((x,i)=>add(x,'domain-element',100,100+i*135)),right=codomain.map((x,i)=>add(x,'codomain-element',550,100+i*135));
  edges=left.map((s,i)=>edge('map-'+i,s,right[codomain.indexOf(images[i])],'f'));
  info={injective:new Set(images).size===images.length,surjective:new Set(images).size===codomain.length};
  description+=' 当前函数：'+(info.injective?'单射':'非单射')+'，'+(info.surjective?'满射':'非满射')+'。';
 } else if(id==='commutative-diagram') {
  const maps=Object.fromEntries(['f','g','h','k'].map(k=>[k,split(p[k]).map(Number)])),n=maps.f.length;
  if(n<1||n>20||Object.values(maps).some(m=>m.length!==n||m.some(x=>!Number.isInteger(x)||x<0||x>=n)))throw new Error('四个映射须等长，像为 0…n−1 的整数。');
  ['A','B','C','D'].forEach((label,i)=>add(label+' = {0,…,'+(n-1)+'}','object',[100,550,100,550][i],[100,100,390,390][i]));
  edges=[edge('f',slots[0].id,slots[1].id,'f'),edge('g',slots[0].id,slots[2].id,'g'),edge('h',slots[1].id,slots[3].id,'h'),edge('k',slots[2].id,slots[3].id,'k')];
  info={commutes:maps.f.every((x,i)=>maps.h[x]===maps.k[maps.g[i]]),maps};description+=(info.commutes?' 当前方形交换：h∘f = k∘g。':' 当前方形不交换：存在两个路径取值不同的元素。');
 } else if(['equivalence-classes','set-partition'].includes(id)) {
  const groups=String(p.groups).split('|').map(split);if(groups.some(g=>!g.length))throw new Error('分组不能为空。');unique(groups.flat(),'全集');
  groups.forEach((group,i)=>add((id==='equivalence-classes'?'['+group[0]+']':'B'+(i+1))+' = {'+group.join(', ')+'}',id==='equivalence-classes'?'equivalence-class':'partition-block',100+(i%3)*265,100+Math.floor(i/3)*175,{visual:{shape:'pill'}}));
  info={groups,universe:groups.flat()};description+=' 全集 = {'+groups.flat().join(', ')+'}。';
 } else if(id==='cartesian-product') {
  const A=unique(split(p.setA),'集合 A'),B=unique(split(p.setB),'集合 B');if(A.length*B.length>200)throw new Error('一次最多表示 200 个有序对。');
  add('A = {'+A.join(', ')+'}','factor-a',100,60);add('A × B','product',365,60);add('B = {'+B.join(', ')+'}','factor-b',630,60);
  A.forEach((a,i)=>B.forEach((b,j)=>add('('+a+', '+b+')','ordered-pair',100+j*235,240+i*140,{semanticCoordinate:{row:i+1,col:j+1,pair:[a,b]}})));
  info={cardinality:A.length*B.length,setA:A,setB:B};
 } else if(id==='permutation') {
  const images=split(p.images).map(Number),n=images.length;unique(images,'置换');if(images.some(x=>!Number.isInteger(x)||x<1||x>n))throw new Error('置换必须是 1…n 的重排。');
  const radius=Math.max(250,n*40),cx=radius+150,cy=radius+120;
  images.forEach((_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n;add(String(i+1),'permutation-element',cx+radius*Math.cos(a),cy+radius*Math.sin(a));});
  edges=images.map((to,i)=>edge('sigma-'+i,slots[i].id,slots[to-1].id,'σ'));const seen=new Set(),cycles=[];
  for(let i=0;i<n;i++){if(seen.has(i))continue;const cycle=[];let j=i;while(!seen.has(j)){seen.add(j);cycle.push(j+1);j=images[j]-1;}cycles.push(cycle);}
  info={images,cycles};description+=' σ = '+cycles.map(c=>'('+c.join(' ')+')').join('')+'。';
 } else if(id==='transformation-group') {
  const n=Number(p.n);if(!Number.isInteger(n)||n<3||n>8)throw new Error('n 须为 3–8 的整数。');
  const elements=[[0,0],[1,0],[0,1]];for(let e=0;e<2;e++)for(let k=0;k<n;k++)if(!elements.some(x=>x[0]===k&&x[1]===e))elements.push([k,e]);
  elements.forEach(([k,e])=>add(k===0?(e?'s':'e'):'r'+(k===1?'':'^'+k)+(e?'s':''),'group-element',100+k*250,120+e*260));
  const target=(k,e)=>slots[elements.findIndex(x=>x[0]===((k%n)+n)%n&&x[1]===e)].id;
  elements.forEach(([k,e],i)=>{edges.push(edge('r-'+i,slots[i].id,target(k+(e?-1:1),e),'r','right-multiply'));if(!e)edges.push(edge('s-'+i,slots[i].id,target(k,1),'s','right-multiply','undirected'));});
  info={order:2*n,presentation:'r^n=e, s^2=e, srs=r^-1'};
 } else if(id==='dynamical-system') {
  const r=Number(p.r),steps=Number(p.steps);let x=Number(p.x0);if(!Number.isFinite(r)||r<0||r>4||x<0||x>1||!Number.isFinite(x)||!Number.isInteger(steps)||steps<1||steps>30)throw new Error('需要 0≤r≤4、0≤x₀≤1，以及 1–30 个迭代步骤。');
  const trajectory=[];for(let i=0;i<=steps;i++){trajectory.push(x);add('x'+i+' = '+Number(x.toPrecision(6)),'state',90+i*290,130);if(i)edges.push(edge('step-'+i,slots[i-1].id,slots[i].id,'r·x(1−x)','evolves-to'));x=r*x*(1-x);}info={trajectory};
 } else if(id==='flow-network') {
  const arcs=String(p.arcs).split(/[;\n]/).filter(s=>s.trim()).map(s=>{const [from,to,value]=split(s),capacity=Number(value);if(!from||!to||from===to||!Number.isFinite(capacity)||capacity<0)throw new Error('每条边需要不同的起终点和非负有限容量。');return{from,to,capacity};});
  const names=[...new Set(arcs.flatMap(a=>[a.from,a.to]))];if(!names.includes('s')||!names.includes('t')||names.length>15||arcs.length>40)throw new Error('需要源 s、汇 t，最多 15 个点和 40 条边。');
  const residual=Object.fromEntries(names.map(n=>[n,{}]));for(const a of arcs){residual[a.from][a.to]=(residual[a.from][a.to]??0)+a.capacity;residual[a.to][a.from]??=0;}
  let maxFlow=0;for(let step=0;step<1000;step++){const parent={s:null},queue=['s'];while(queue.length&&!('t'in parent)){const u=queue.shift();for(const[v,c]of Object.entries(residual[u]))if(c>0&&!(v in parent)){parent[v]=u;queue.push(v);}}
   if(!('t'in parent))break;let amount=Infinity;for(let v='t';parent[v]!=null;v=parent[v])amount=Math.min(amount,residual[parent[v]][v]);for(let v='t';parent[v]!=null;v=parent[v]){const u=parent[v];residual[u][v]-=amount;residual[v][u]=(residual[v][u]??0)+amount;}maxFlow+=amount;
  }
  names.forEach((name,i)=>add(name,name==='s'?'source':name==='t'?'sink':'junction',name==='s'?100:name==='t'?850:450,100+(name==='s'||name==='t'?1:i)*140));
  edges=arcs.map((a,i)=>edge('flow-'+i,slots[names.indexOf(a.from)].id,slots[names.indexOf(a.to)].id,'≤ '+a.capacity,'capacity'));
  info={maxFlow,arcs};description+=' 最大流 = '+maxFlow+'。边标注容量上界；反向残量不冒充实际流量。';
 }
 return {...template,description,slots,edges,layout:place(slots,positions),runtimeMetadata:{...info,semanticModel:id,computed:template.computable!==false}};
}

export function upgradeSemanticTemplate(original) {
 const replacement=SEMANTIC_TEMPLATES.find(t=>t.id===original.id);if(replacement)return replacement;
 const t=structuredClone(original),id=t.id.slice(8);
 if(id==='decision-tree'){
  t.slots[0].label='条件 P？';t.slots[0].role='condition';t.slots[1].label='P 成立时';t.slots[1].role='outcome';t.slots[2].label='P 不成立时';t.slots[2].role='outcome';
  t.edges=[edge('decision-yes',t.slots[0].id,t.slots[1].id,'是','branch','conditional'),edge('decision-no',t.slots[0].id,t.slots[2].id,'否','branch','conditional')];
  t.description='条件分支与互斥结果；分支标签标明成立条件。';
 }else if(id==='proof-tree'||id==='dependency-dag'){
  const proof=id==='proof-tree';t.slots.push(node(id+'-4',proof?'前提 B':'先修 B',proof?'premise':'input',{semanticCoordinate:{layer:2,order:2}}));
  t.edges=[edge(id+'-a',t.slots[0].id,t.slots[1].id,proof?'依据':'依赖',proof?'proves':'depends-on'),edge(id+'-b',t.slots[3].id,t.slots[1].id,proof?'依据':'依赖',proof?'proves':'depends-on'),edge(id+'-c',t.slots[1].id,t.slots[2].id,proof?'推出':'形成',proof?'implies':'depends-on')];
  t.description=proof?'多前提汇合到推理步骤与结论；填入的推理仍须有证据。':'多项先修汇合到依赖步骤与目标；只承载有依据的无环依赖。';
 }else if(id==='state-machine'){
  t.slots.forEach((s,i)=>{s.label=['q₀ · 初态','q₁','q₂ · 终态'][i];s.visual={shape:'circle'};});
  t.edges=[edge('a',t.slots[0].id,t.slots[1].id,'事件 a','transition'),edge('b',t.slots[1].id,t.slots[2].id,'事件 b','transition'),edge('reset',t.slots[1].id,t.slots[0].id,'reset','transition')];t.description='状态、初态/终态与带触发条件的转移；可编辑转移模型。';
 }else if(id==='lattice'){
  t.slots=[node('lattice-1','∅','bottom',{semanticCoordinate:{rank:0}}),node('lattice-2','{a}','element',{semanticCoordinate:{rank:1}}),node('lattice-3','{a,b}','top',{semanticCoordinate:{rank:2}}),node('lattice-4','{b}','element',{semanticCoordinate:{rank:1}})];
  t.edges=[edge('la','lattice-1','lattice-2','≺','covers'),edge('lb','lattice-1','lattice-4','≺','covers'),edge('lc','lattice-2','lattice-3','≺','covers'),edge('ld','lattice-4','lattice-3','≺','covers')];t.description='以幂集 P({a,b}) 的包含序为起始格；交为 meet，并为 join。偏序工具可检查上下界。';
 }
 if(['decision-tree','proof-tree','dependency-dag','state-machine','lattice'].includes(id))t.version=4;
 return t;
}

export function structureCapabilityCatalog(templates) {
 return templates.filter(t=>!t.hidden&&!t.deprecated).map(t=>({id:t.id,version:t.version,name:t.name,affordances:t.capability?.affordances??[t.layout.type],ordering:t.capability?.ordering??'model-defined',parameters:t.parameters,layout:t.layout,implementation:t.slotFactory??'declarative',family:t.family??null,compatibilityAliases:templates.filter(alias=>alias.replacementTemplateId===t.id).map(alias=>({...alias.familyAlias,id:alias.id,replacementTemplateId:alias.replacementTemplateId})),scope:'runtime',supportsPackageLocal:true}));
}
