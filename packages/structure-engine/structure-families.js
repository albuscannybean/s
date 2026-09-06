import {formatSequenceName,spreadsheetName} from '../domain/naming-policy.js';

const i18n=(zh,en)=>({'zh-CN':zh,en});
const parameter=(id,zh,en,type,defaultValue,extra={})=>({id,label:zh,labelI18n:i18n(zh,en),type,defaultValue,...extra});
const option=(value,zh,en)=>({value,label:zh,labelI18n:i18n(zh,en)});
export const NUMBERING_PARAMETERS=[
 parameter('numbering','编号方式','Numbering','enum','alphabet',{options:[option('none','不编号','None'),option('numeric','数字','Numbers'),option('alphabet','大写字母','Uppercase letters'),option('lowercase','小写字母','Lowercase letters'),option('roman','罗马数字','Roman numerals'),option('custom','自定义格式','Custom format')]}),
 parameter('numberFormat','编号格式：{n}、{A}、{a}、{i}、{label}','Format: {n}, {A}, {a}, {i}, {label}','string','{n}'),
 parameter('numberStart','起始编号','First number','number',1,{min:0,max:10000})
];
export const DIRECTED_GRAPH_FAMILY={
 id:'builtin:directed-graph',version:5,name:'有向节点图 · Directed Node Graph',nameI18n:i18n('有向节点图','Directed Node Graph'),
 description:'统一有向链、依赖与一般有向网络；节点数量、拓扑、布局和命名独立配置。具体关系的含义由实例保留。',
 descriptionI18n:i18n('统一有向链、依赖与一般有向网络；节点数量、拓扑、布局和命名独立配置。具体关系的含义由实例保留。','One family for directed chains, dependencies and general directed networks. Configure size, topology, layout and naming independently; individual relations retain their meaning.'),
 category:'graph',maturity:'ready',builtin:true,nestable:true,computable:false,parameterized:true,slotFactory:'directed-node-family',slots:['A','B','C'].map((id,i)=>({id,label:id,role:'node',semanticCoordinate:{order:i},accepts:['knowledge','structure','value','variable'],cardinality:'many'})),edges:[{id:'ab',sourceSlotId:'A',targetSlotId:'B',direction:'directed',relationType:'related',label:''},{id:'bc',sourceSlotId:'B',targetSlotId:'C',direction:'directed',relationType:'related',label:''}],variables:[],
 parameters:[parameter('nodeCount','节点数量','Number of nodes','number',3,{min:1,max:100}),parameter('topology','连接拓扑','Topology','enum','network',{options:[option('chain','单向链','Directed chain'),option('dag','有向无环网络','Directed acyclic graph'),option('network','自由有向网络','Directed network')]}),parameter('layoutMode','排列布局','Layout','enum','force',{options:[option('linear','线性排列','Linear'),option('layered','分层排列','Layered'),option('force','自由网络','Free network')]}),parameter('nodeLabels','节点标签（逗号分隔，可留空）','Node labels (comma separated, optional)','string',''),...NUMBERING_PARAMETERS,parameter('relationType','关系类型','Relation type','string','related'),parameter('relationLabel','关系显示名称（可留空）','Relation label (optional)','string','')],
 constraints:[],rules:[],layout:{type:'force'},viewCapability:{mode:'arrange',label:'可排列',defaultArrangement:'horizontal-forward',options:['horizontal-forward','horizontal-reverse','vertical-forward','vertical-reverse']},
 family:{id:'directed-node',invariants:['independent-relation-identity','directed-incidence'],presets:[{id:'chain',parameters:{topology:'chain',layoutMode:'linear'}},{id:'dependency',parameters:{topology:'dag',layoutMode:'layered',relationType:'depends-on'}},{id:'temporal',parameters:{topology:'chain',layoutMode:'linear',relationType:'precedes'}},{id:'proof',parameters:{topology:'dag',layoutMode:'layered',relationType:'implies'}}]},
 capability:{affordances:['directed-relations','sequence','dependency','temporal-order','proof-flow','network'],ordering:'parameter-defined',evidenceRequired:true},visual:{accent:'#527c8b',relationStyle:{routing:'straight',labelPosition:'center'}}
};

export const VENN_FAMILY={id:'builtin:venn',version:5,name:'韦恩图 · Venn Diagram',nameI18n:i18n('韦恩图','Venn Diagram'),description:'以二或三个集合的交、差与归属区域表示集合关系。',descriptionI18n:i18n('以二或三个集合的交、差与归属区域表示集合关系。','Represent intersection, difference and membership regions for two or three sets.'),category:'venn',builtin:true,nestable:true,computable:false,parameterized:true,slotFactory:'venn-family',slots:[],edges:[],parameters:[parameter('setCount','集合数量','Number of sets','enum','2',{options:[option('2','两个集合','Two sets'),option('3','三个集合','Three sets')]}),parameter('setA','集合 A','Set A','string','A'),parameter('setB','集合 B','Set B','string','B'),parameter('setC','集合 C','Set C','string','C')],constraints:[],rules:[],layout:{type:'venn',sets:2},family:{id:'venn',invariants:['set-region-membership']},capability:{affordances:['set-overlap','intersection','set-difference'],ordering:'unordered'},visual:{accent:'#687da7'}};

export const FAMILY_ALIASES=Object.freeze({'builtin:timeline':{id:'builtin:directed-graph',preset:'temporal'},'builtin:dependency-dag':{id:'builtin:directed-graph',preset:'dependency'},'builtin:proof-tree':{id:'builtin:directed-graph',preset:'proof'},'builtin:venn-2':{id:'builtin:venn',parameters:{setCount:'2'}},'builtin:venn-3':{id:'builtin:venn',parameters:{setCount:'3'}}});
export function consolidateStructureFamily(template){
 if(template.id===DIRECTED_GRAPH_FAMILY.id)return structuredClone(DIRECTED_GRAPH_FAMILY);
 const alias=FAMILY_ALIASES[template.id];return alias?{...template,hidden:true,deprecated:true,replacementTemplateId:alias.id,familyAlias:structuredClone(alias)}:template;
}
const split=value=>String(value??'').split(/[,，\n]/).map(x=>x.trim());
const slot=(id,label,role,semanticCoordinate={})=>({id,label,role,semanticCoordinate,accepts:['knowledge','structure','value','variable'],cardinality:'many'});
export function materializeStructureFamily(template,parameters={}){
 const p={...Object.fromEntries((template.parameters??[]).map(x=>[x.id,x.defaultValue])),...parameters};
 if(template.slotFactory==='directed-node-family'){
  const n=Number(p.nodeCount);if(!Number.isInteger(n)||n<1||n>100)throw new Error('节点数量须为 1–100 的整数。');
  if(!['chain','dag','network'].includes(p.topology)||!['linear','layered','force'].includes(p.layoutMode))throw new Error('不支持的有向图拓扑或排列。');
  const labels=split(p.nodeLabels),slots=Array.from({length:n},(_,i)=>slot(spreadsheetName(i),formatSequenceName(i,{style:p.numbering,format:p.numberFormat,start:p.numberStart,label:labels[i]??''}),'node',{order:i,layer:i}));
  const edges=Array.from({length:n-1},(_,i)=>({id:i<2?['ab','bc'][i]:'edge-'+(i+1),sourceSlotId:slots[i].id,targetSlotId:slots[i+1].id,direction:'directed',relationType:String(p.relationType??'related').trim()||'related',label:String(p.relationLabel??''),routing:'straight',visual:{labelPosition:'center'}}));
  const layoutType={linear:'timeline',layered:'layered',force:'force'}[p.layoutMode];
  return{...template,slots,edges,layout:{type:layoutType},viewCapability:{...template.viewCapability,defaultArrangement:layoutType==='layered'?'vertical-forward':'horizontal-forward'},constraints:p.topology==='network'?[]:[{type:'acyclic'},...(p.topology==='chain'?[{type:'linear-chain'}]:[])],runtimeMetadata:{family:'directed-node',topology:p.topology,naming:{style:p.numbering,format:p.numberFormat,start:p.numberStart}}};
 }
 if(template.slotFactory==='venn-family'){
  const count=Number(p.setCount);if(![2,3].includes(count))throw new Error('韦恩图支持两个或三个集合。');
  const names=[p.setA,p.setB,p.setC].slice(0,count).map(String);if(names.some(n=>!n.trim())||new Set(names).size!==count)throw new Error('集合名称须非空且互不重复。');
  const ids=count===2?['A-only','intersection','B-only']:['A','B','C','AB','AC','BC','ABC'],members=count===2?[[0],[0,1],[1]]:[[0],[1],[2],[0,1],[0,2],[1,2],[0,1,2]];
  const slots=members.map((included,i)=>{const excluded=Array.from({length:count},(_,i)=>i).filter(i=>!included.includes(i)),inside=included.map(i=>names[i]).join('∩'),outside=excluded.map(i=>names[i]).join('∪');return slot(ids[i],outside?'('+inside+')∖('+outside+')':inside,'set-region',{sets:included.map(i=>'ABC'[i]),excludes:excluded.map(i=>'ABC'[i])});});
  return{...template,slots,edges:[],layout:{type:'venn',sets:count},runtimeMetadata:{family:'venn',setNames:names}};
 }
 return null;
}

/** Validate incidence independently of edge labels and parallel relation identities. */
export function validateGraphFamily(definition){
 if(definition.runtimeMetadata?.family!=='directed-node')return[];
 const topology=definition.runtimeMetadata.topology;if(topology==='network')return[];
 const adjacency=new Map(definition.slots.map(s=>[s.id,new Set()])),incoming=new Map(definition.slots.map(s=>[s.id,new Set()]));
 for(const e of definition.edges){adjacency.get(e.sourceSlotId)?.add(e.targetSlotId);incoming.get(e.targetSlotId)?.add(e.sourceSlotId);}
 const active=new Set(),done=new Set();const cycle=id=>{if(active.has(id))return true;if(done.has(id))return false;active.add(id);for(const next of adjacency.get(id)??[])if(cycle(next))return true;active.delete(id);done.add(id);return false;};
 const errors=[];if([...adjacency.keys()].some(cycle))errors.push('有向无环结构不能包含循环。');
 if(topology==='chain'&&([...adjacency.values()].some(v=>v.size>1)||[...incoming.values()].some(v=>v.size>1)))errors.push('单向链的每个节点最多连接一个前驱和一个后继；分支关系应使用有向网络。');
 return errors;
}
