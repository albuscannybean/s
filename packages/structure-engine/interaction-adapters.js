import {DEFAULT_OBJECT_CAPABILITIES,normalizeObjectCapabilities} from '../domain/semantic-container.js';
import {analyzePoset,validatePoset} from './poset.js';

const fixedGenerated=new Set(['builtin:lmn-432','builtin:mod-n','builtin:mod-12','builtin:boolean-algebra','builtin:cyclic-group','builtin:regular-polygon','builtin:operation-table']);
const graphLayouts=new Set(['force','grid','manual','layered','timeline']);
const mergeCapabilities=patch=>normalizeObjectCapabilities(patch);
const generatedCapabilities=Object.freeze({canRenameDisplayLabel:true,canDeleteCanonicalObject:false,canMoveVisualPosition:false,canMoveSemanticPosition:false,canEditSemanticRole:false,canChangeEndpoints:false,canChangeDirection:false,canChangeRelationType:false});
const isCanonicalSlot=(template,slot,instance)=>(template?.slots??[]).some(item=>item.id===slot?.id)||!!template?.slotFactory&&!(instance?.overrides?.addedSlots??[]).some(item=>item.id===slot?.id);
const isCanonicalEdge=(template,edge,instance)=>(template?.edges??[]).some(item=>item.id===edge?.id)||!!template?.slotFactory&&!(instance?.overrides?.addedEdges??[]).some(item=>item.id===edge?.id);

export function getStructureInteractionAdapter(template){
  const id=template?.id??'',layout=template?.layout?.type??'grid';
  if(id==='builtin:poset-hasse')return posetAdapter;
  if(id==='builtin:mod-n'||id==='builtin:mod-12')return modularAdapter;
  if(id==='builtin:boolean-algebra')return booleanAdapter;
  if(id==='builtin:lmn-432')return lmnAdapter;
  if(id==='builtin:tree'||layout==='tree')return treeAdapter;
  if(id==='builtin:coordinate-plane'||layout==='coordinate')return coordinateAdapter;
  if(template?.category==='venn'||layout==='venn')return vennAdapter;
  if(graphLayouts.has(layout)&&!fixedGenerated.has(id))return graphAdapter;
  if(fixedGenerated.has(id))return generatedAdapter;
  return graphAdapter;
}

const base={
  id:'generic',
  getContainerCapabilities:(slot,instance,template)=>mergeCapabilities({canDeleteCanonicalObject:!(template?.builtin&&isCanonicalSlot(template,slot,instance))}),
  getEdgeCapabilities:(edge,instance,template)=>mergeCapabilities({canRenameDisplayLabel:true,canEditContent:true,canEditAppearance:true,canDeleteCanonicalObject:!(template?.builtin&&isCanonicalEdge(template,edge,instance)),canChangeEndpoints:!(template?.builtin&&isCanonicalEdge(template,edge,instance)),canChangeDirection:!(template?.builtin&&isCanonicalEdge(template,edge,instance)),canChangeRelationType:!(template?.builtin&&isCanonicalEdge(template,edge,instance))}),
  getCreateActions:()=>[{id:'add-container-content',label:'添加容器正文',kind:'container-content'}],
  getContextActions:()=>[],
  prepareDefinition:definition=>definition,
  validateStructure:()=>({valid:true,errors:[]})
};

const generatedAdapter={...base,id:'generated',getContainerCapabilities:()=>mergeCapabilities(generatedCapabilities),getEdgeCapabilities:(edge,instance,template)=>mergeCapabilities(isCanonicalEdge(template,edge,instance)?generatedCapabilities:{canRenameDisplayLabel:true,canEditContent:true,canEditAppearance:true,canDeleteCanonicalObject:true,canChangeEndpoints:true,canChangeDirection:true,canChangeRelationType:true}),getCreateActions:()=>[{id:'add-container-content',label:'添加容器内容',kind:'container-content'}]};
const lmnAdapter={...generatedAdapter,id:'lmn',getContainerCapabilities:()=>mergeCapabilities({...generatedCapabilities,canRenameDisplayLabel:true,canEditContent:true,canEditAppearance:true,canAddVariable:false}),getEdgeCapabilities:(edge,instance,template)=>{const canonical=isCanonicalEdge(template,edge,instance);return mergeCapabilities({...generatedCapabilities,canRenameDisplayLabel:true,canEditContent:true,canEditAppearance:true,canChangeDirection:!canonical,canDeleteCanonicalObject:!canonical,canChangeEndpoints:!canonical,canChangeRelationType:!canonical})},getCreateActions:()=>[{id:'add-knowledge',label:'添加知识',kind:'container-content'},{id:'add-container-content',label:'添加正文',kind:'container-content'},{id:'add-structure',label:'添加结构',kind:'container-content'}]};
const modularAdapter={...generatedAdapter,id:'modular',getContainerCapabilities:()=>mergeCapabilities({...generatedCapabilities,canEditContent:true,canEditAppearance:true}),getCreateActions:()=>[{id:'add-variable',label:'添加变量',kind:'variable'},{id:'add-container-content',label:'添加正文',kind:'container-content'},{id:'change-modulus',label:'修改模数',kind:'parameters'},{id:'load-variable-scheme',label:'加载变量方案',kind:'variable'}]};
const booleanAdapter={...generatedAdapter,id:'boolean',getContainerCapabilities:()=>mergeCapabilities({...generatedCapabilities,canEditContent:true,canEditAppearance:true,canAddVariable:false}),getCreateActions:()=>[{id:'modify-rank',label:'修改维数',kind:'parameters'},{id:'rename-selected',label:'修改元素名称',kind:'display'},{id:'add-container-content',label:'添加正文',kind:'container-content'}],getContextActions:()=>[{id:'boolean-complement',label:'查看补元'},{id:'boolean-closures',label:'查看上下闭包'}]};
const graphAdapter={...base,id:'graph',getContainerCapabilities:()=>mergeCapabilities({}),getCreateActions:()=>[{id:'add-node',label:'添加节点',kind:'topology'},{id:'add-relation',label:'添加关系',kind:'topology'},{id:'add-container-content',label:'添加正文',kind:'container-content'}],getContextActions:()=>[{id:'connect',label:'建立关系'}]};
const treeAdapter={...base,id:'tree',getCreateActions:()=>[{id:'add-tree-topic',label:'添加主题',kind:'topology'},{id:'add-tree-child',label:'添加子节点',kind:'topology'},{id:'add-container-content',label:'添加正文',kind:'container-content'}]};
const coordinateAdapter={...base,id:'coordinate',getContainerCapabilities:()=>mergeCapabilities({...generatedCapabilities,canRenameDisplayLabel:true,canEditContent:false,canAddKnowledge:false,canAddStructure:false,canAddLocalContent:false,canAddVariable:false,canAddFormula:false,canAddRelation:false}),getCreateActions:()=>[{id:'add-point',label:'添加点',kind:'topology'},{id:'add-vector',label:'添加向量',kind:'topology'},{id:'add-curve',label:'添加曲线',kind:'plot'},{id:'add-surface',label:'添加曲面',kind:'plot'}]};
const vennAdapter={...generatedAdapter,id:'venn',getContainerCapabilities:()=>mergeCapabilities({...generatedCapabilities,canEditContent:true,canEditAppearance:true,canAddVariable:false}),getCreateActions:()=>[{id:'venn-add-set',label:'添加集合',kind:'parameters'},{id:'venn-remove-set',label:'移除集合',kind:'parameters'},{id:'venn-rename-set',label:'重命名集合',kind:'display'},{id:'add-container-content',label:'添加区域正文',kind:'container-content'}],prepareDefinition:(definition,instance)=>{const labels=instance?.parameters?.setLabels??(Number(definition.layout?.sets)===3?['A','B','C']:['A','B']),name={"A-only":`${labels[0]}∖${labels[1]}`,intersection:`${labels[0]}∩${labels[1]}`,"B-only":`${labels[1]}∖${labels[0]}`,A:`${labels[0]} only`,B:`${labels[1]} only`,C:`${labels[2]} only`,AB:`${labels[0]}∩${labels[1]}`,AC:`${labels[0]}∩${labels[2]}`,BC:`${labels[1]}∩${labels[2]}`,ABC:labels.join('∩')};return{...definition,slots:definition.slots.map(slot=>({...slot,label:name[slot.id]??slot.label,canonicalDefaultLabel:name[slot.id]??slot.label}))}}};
const posetAdapter={...base,id:'poset',getContainerCapabilities:(slot,instance,template)=>{
  const canonical=(template?.slots??[]).some(item=>item.id===slot?.id);
  return mergeCapabilities({canDeleteCanonicalObject:!canonical,canMoveSemanticPosition:false,canEditSemanticRole:false});
},getEdgeCapabilities:(edge,instance,template)=>{
  const canonical=isCanonicalEdge(template,edge,instance);
  return mergeCapabilities(canonical?generatedCapabilities:{});
},getCreateActions:()=>[{id:'add-poset-element',label:'添加元素',kind:'topology'},{id:'add-cover-relation',label:'添加覆盖关系',kind:'topology'},{id:'import-poset-relations',label:'导入关系',kind:'topology'},{id:'add-container-content',label:'添加正文',kind:'container-content'}],getContextActions:()=>[{id:'add-cover-relation',label:'添加覆盖关系'},{id:'show-poset-bounds',label:'查看上界 / 下界'}],prepareDefinition:definition=>{const analysis=analyzePoset(definition.slots,definition.edges),slots=definition.slots.map(slot=>({...slot,semanticCoordinate:{...(slot.semanticCoordinate??{}),rank:slot.semanticCoordinate?.preferredRank??analysis.ranks[slot.id]??0}}));return{...definition,slots,edges:analysis.valid?analysis.reduction:definition.edges,runtimeMetadata:{...(definition.runtimeMetadata??{}),poset:analysis,declaredRelations:definition.edges}}},validateStructure:definition=>definition.runtimeMetadata?.poset?{valid:definition.runtimeMetadata.poset.valid,errors:definition.runtimeMetadata.poset.errors,analysis:definition.runtimeMetadata.poset}:validatePoset(definition.slots,definition.edges)};

export function structureCreateActions(template,instance=null){return getStructureInteractionAdapter(template).getCreateActions(template,instance)}
export function containerCapabilities(template,slot,instance){return getStructureInteractionAdapter(template).getContainerCapabilities(slot,instance,template)}
export function edgeCapabilities(template,edge,instance){return getStructureInteractionAdapter(template).getEdgeCapabilities(edge,instance,template)}
export {DEFAULT_OBJECT_CAPABILITIES};
