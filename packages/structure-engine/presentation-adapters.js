import {containerBadges} from '../domain/semantic-container.js';
import {analyzePoset} from './poset.js';
import {getEffectiveTitle} from '../domain/identity.js';

const choose=(n,k)=>{let value=1;for(let index=1;index<=k;index++)value=value*(n-index+1)/index;return Math.round(value)};

export function getStructurePresentationAdapter(template){
  const id=template?.id??'';
  if(id==='builtin:boolean-algebra')return booleanPresentation;
  if(id==='builtin:mod-n'||id==='builtin:mod-12')return modularPresentation;
  if(id==='builtin:poset-hasse')return posetPresentation;
  if(id==='builtin:operation-table')return operationTablePresentation;
  if(id==='builtin:cyclic-group')return cyclicPresentation;
  return genericPresentation;
}

const genericPresentation={
  id:'generic',
  getStructureTitle:(template,instance,definition)=>`${template.name} · ${definition.slots.length} 个位置`,
  getContainerBadges:entry=>containerBadges(entry),
  getNavigatorSummary:()=>null,
  getSpecialBackground:()=>null,
  getQuickPreview:({slot,entry,instance,state})=>{const title=getEffectiveTitle(slot,{kind:'slot',instance,state,container:entry?.container}),badges=containerBadges(entry);return{title,eyebrow:slot.role??'语义位置',lines:badges.items.slice(0,4).map(item=>item.content?.title).filter(Boolean),meta:badges.total?`${badges.total} 项内容 · 单击打开`:'空容器 · 单击添加内容',overflowCount:Math.max(0,badges.total-4)}}
};

const booleanPresentation={...genericPresentation,id:'boolean',getStructureTitle:(template,instance,definition)=>`布尔代数 B${instance.parameters.rank??definition.runtimeMetadata?.rank??4} · ${definition.slots.length} 个元素`,getNavigatorSummary:(template,instance,definition)=>{const rank=Number(instance.parameters.rank??definition.runtimeMetadata?.rank??4);return{kind:'boolean-ranks',rows:Array.from({length:rank+1},(_,level)=>({id:`rank:${level}`,label:`层级 ${level}`,meta:`${choose(rank,level)} 个元素`,children:definition.slots.filter(slot=>Number(slot.semanticCoordinate?.rank)===level).map(slot=>({id:`slot:${slot.id}`,label:slot.label,meta:slot.role,slotId:slot.id}))}))}}};

const modularPresentation={...genericPresentation,id:'modular',getStructureTitle:(template,instance)=>`模结构 ℤ/${instance.parameters.modulus??12}ℤ`,getNavigatorSummary:(template,instance,definition,index)=>{const variables=instance.variables??[],inputs=variables.filter(item=>item.kind==='input'||item.kind==='constant'),derived=variables.filter(item=>item.kind==='derived');return{kind:'modular',rows:[{id:'parameters',label:'参数',meta:`模数 = ${instance.parameters.modulus??12}`},{id:'variables',label:'变量',meta:String(variables.length),children:[...inputs,...derived].map(item=>({id:`variable:${item.id}`,label:item.displayName??item.label??'变量',meta:item.kind==='derived'?'派生变量':'输入变量',variableId:item.id}))},{id:'positions',label:'位置',meta:String(definition.slots.length),children:definition.slots.map(slot=>{const badges=containerBadges(index?.bySlotId?.[slot.id]);return{id:`slot:${slot.id}`,label:getEffectiveTitle(slot,{kind:'slot',instance,container:index?.bySlotId?.[slot.id]?.container}),meta:badges.total?`${badges.total} 项内容`:'空',slotId:slot.id}})}]}},getQuickPreview:({slot,entry,instance})=>{const residue=slot.semanticCoordinate?.modularIndex??slot.label,variables=(entry?.runtimeChildren??[]).filter(item=>item.metadata?.visible!==false),visible=variables.slice(0,5).map(item=>item.content?.title??item.metadata?.label??'变量');return{title:`位置 ${residue}`,eyebrow:`模空间 ℤ/${instance.parameters?.modulus??'?'}ℤ`,lines:visible,meta:variables.length?`${variables.length} 个变量位于此处`:'此位置暂无变量',overflowCount:Math.max(0,variables.length-visible.length)}}};

const posetPresentation={...genericPresentation,id:'poset',getStructureTitle:(template,instance,definition)=>`偏序 Poset · ${definition.slots.length} 个元素`,getNavigatorSummary:(template,instance,definition,index)=>{const analysis=analyzePoset(definition.slots,definition.edges),label=id=>definition.slots.find(item=>item.id===id)?.label??id;return{kind:'poset',rows:[{id:'elements',label:'元素',meta:String(definition.slots.length),children:definition.slots.map(slot=>{const badges=containerBadges(index?.bySlotId?.[slot.id]);return{id:`slot:${slot.id}`,label:slot.label,meta:badges.total?`${badges.total} 项内容`:'',slotId:slot.id}})},{id:'covers',label:'覆盖关系',meta:String(analysis.coverCount)},{id:'properties',label:'性质',meta:analysis.valid?(analysis.lattice?'有效偏序 · 格':'有效偏序'):'无效偏序',children:[{id:'minimal',label:'极小元',meta:analysis.minimal.map(label).join(', ')||'—'},{id:'maximal',label:'极大元',meta:analysis.maximal.map(label).join(', ')||'—'},{id:'least',label:'最小元',meta:analysis.least?label(analysis.least):'不存在'},{id:'greatest',label:'最大元',meta:analysis.greatest?label(analysis.greatest):'不存在'}]}]}}};

const operationTablePresentation={...genericPresentation,id:'operation-table',getNavigatorSummary:(template,instance)=>{const n=Number(instance.parameters.n??4),operation=instance.parameters.operation==='multiply-mod-n'?'模 n 乘法':'模 n 加法';return{kind:'operation-table',rows:[{id:'elements',label:'元素',meta:String(n)},{id:'operation',label:'运算',meta:operation},{id:'table',label:'表格',meta:`${n} × ${n}`} ]}}};
const cyclicPresentation={...genericPresentation,id:'cyclic',getStructureTitle:(template,instance,definition)=>`循环群 C${instance.parameters.n??definition.slots.length} · ${definition.slots.length} 个元素`,getNavigatorSummary:(template,instance,definition)=>({kind:'cyclic-group',rows:[{id:'order',label:'群阶',meta:`n = ${instance.parameters.n??8}`},{id:'element',label:'选定元素',meta:String(instance.parameters.generator??1)},{id:'elements',label:'群元素',meta:String(definition.slots.length)}]})};

export function structureNavigatorPresentation(template,instance,definition,index){return getStructurePresentationAdapter(template).getNavigatorSummary(template,instance,definition,index)}
export function structureTitle(template,instance,definition){return getStructurePresentationAdapter(template).getStructureTitle(template,instance,definition)}
export function objectQuickPreview(template,context){return getStructurePresentationAdapter(template).getQuickPreview(context)}
