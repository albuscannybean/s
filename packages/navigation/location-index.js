import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {getEffectiveTitle} from '../domain/identity.js';
import {containerItemLabel} from '../domain/semantic-container.js';
import {makeDocumentId} from './document-id.js';

const text=(...values)=>values.filter(v=>v!=null).map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' ');
const mode=value=>(value?.mode??value?.metadata?.placementMode)==='reference'?'reference':'construct';
const hasBody=record=>!!text(record?.body,record?.summary,record?.latex,typeof record?.content==='string'?record.content:null,record?.objectContent?.body,record?.objectContent?.summary,record?.objectContent?.displayFormula).trim();
const labels={
 'zh-CN':{knowledge:'知识',structure:'结构',slot:'未命名节点',content:'正文',note:'正文',variable:'变量',relation:'关系',geometry:'几何对象',inputs:'输入变量',derived:'派生变量',relations:'关系',geometryGroup:'几何与图形',unassigned:'未归属内容',board:'画板'},
 en:{knowledge:'Knowledge',structure:'Structure',slot:'Unnamed node',content:'Content',note:'Notes',variable:'Variable',relation:'Relation',geometry:'Geometry',inputs:'Input variables',derived:'Derived variables',relations:'Relations',geometryGroup:'Geometry and plots',unassigned:'Unassigned content',board:'Board'}
};

/** JSON tuple keys prevent collisions when any ID contains colons, slashes or Unicode. */
export function navigatorObjectKey(target={}){
 if(typeof target==='string')return target;
 const kind=target.kind??target.type;
 return 'nav:'+JSON.stringify([kind,target.instanceId??'',target.slotId??'',target.id??target.itemId??'',target.geometryType??'',target.contentScope??'']);
}
export const navigatorExpansionKey=navigatorObjectKey;

/** One read-only location index serves tree navigation, search, breadcrumbs and reveal. */
export function buildNavigatorIndex(state={},options={}){
 const language=options.language,strings=labels[language]??labels['zh-CN'],objects=new Map(),definitions=new Map(),diagnostics=[],candidates=new Map(),links=new Map(),sourceInstances=new Map((state.structureInstances??[]).map(i=>[i.id,i])),sourceKnowledge=new Map((state.knowledge??[]).map(k=>[k.id,k])),templates=new Map((state.structureTemplates??[]).map(t=>[t.id,t])),globalContents=new Map((state.contentObjects??[]).map(c=>[c.id,c])),usedContents=new Set();
 let serial=0;
 const label=(kind,record,context={})=>{
  const supplied=options.labelFor?.(kind,record,context);if(supplied!=null)return String(supplied);
  const localized=record?.displayTitle??record?.displayLabel??record?.titleI18n?.[language]??record?.nameI18n?.[language];
  if(kind==='structure'){const template=context.template,instance=record,custom=instance.displayTitle??instance.objectContent?.title;return String(custom&&custom!==template?.name?custom:language&&template?.nameI18n?.[language]||custom||template?.name||strings.structure);}
  return String(localized??record?.title??record?.label??record?.name??strings[kind]??kind);
 };
 const add=(target,record={},extra={})=>{
  const key=navigatorObjectKey(target);if(objects.has(key))return objects.get(key);
  const entry={...target,key,record,label:label(target.kind,record,extra),order:serial++,searchText:text(record.title,record.label,record.name,record.content,record.objectContent,record.tags,record.sources,record.formula),...extra};const supplied=options.labelFor?.(target.kind,record,{...extra,instanceId:target.instanceId,slotId:target.slotId});if(supplied!=null)entry.label=String(supplied);objects.set(key,entry);return entry;
 };
 const link=(parent,child,{priority=2,order=0,reference=false,source='ownership'}={})=>{
  const p=typeof parent==='string'?parent:parent?.key,c=typeof child==='string'?child:child?.key;if(!p||!c||!objects.has(p)||!objects.has(c))return;
  const key=JSON.stringify([p,c]),next={parent:p,child:c,priority,order:Number(order)||0,reference,source},previous=links.get(key);
  if(!previous||priority<previous.priority||priority===previous.priority&&previous.reference&&!reference)links.set(key,next);
 };
 const group=(id,parent,title,extra={})=>{const entry=add({kind:'group',id,instanceId:parent.instanceId??(parent.kind==='structure'?parent.id:undefined)},{title},{synthetic:true,...extra});link(parent,entry,{priority:-10,order:9000});return entry;};
 const knowledgeEntries=new Map();for(const k of sourceKnowledge.values())knowledgeEntries.set(k.id,add({kind:'knowledge',id:k.id},k));
 for(const instance of sourceInstances.values()){
  const template=templates.get(instance.templateId),entry=add({kind:'structure',id:instance.id},instance,{template,document:makeDocumentId('structure',instance.id)});
  let definition,copy;try{copy=structuredClone(instance);definition=template?materializeInstanceDefinition(template,copy):null;}catch(error){diagnostics.push({type:'invalid-structure',id:instance.id,message:error.message});}
  if(!definition){definition={slots:instance.overrides?.addedSlots??[],edges:instance.overrides?.addedEdges??[]};copy=instance;if(!template)diagnostics.push({type:'missing-template',id:instance.id,templateId:instance.templateId});}
  definitions.set(instance.id,definition);
  if(knowledgeEntries.has(instance.ownerKnowledgeId))link(knowledgeEntries.get(instance.ownerKnowledgeId),entry,{priority:5,source:'owner'});
  const slotMap=new Map((definition.slots??[]).map(s=>[s.id,s]));for(const [id,container]of Object.entries(copy.containers??{}))if(!slotMap.has(id)&&(container.children?.length||hasBody(container.content)))slotMap.set(id,{id,label:container.localDisplayTitle||container.label||id,role:'recovered-container',recovered:true});
  for(const binding of instance.bindings??[])if(!slotMap.has(binding.slotId))slotMap.set(binding.slotId,{id:binding.slotId,label:binding.slotId,role:'recovered-container',recovered:true});
  for(const slot of slotMap.values()){
   const container=copy.containers?.[slot.id],title=slot.label?getEffectiveTitle(slot,{kind:'slot',instance:copy,state,container}):container?.localDisplayTitle||strings.slot;
   const slotEntry=add({kind:'slot',id:slot.id,instanceId:instance.id},slot,{label:title,slotId:slot.id,document:makeDocumentId('container',instance.id,slot.id),container,recovered:!!slot.recovered,searchText:text(title,slot.role,container?.content)});link(entry,slotEntry,{priority:-10,order:slot.semanticCoordinate?.order??slotEntry.order});
   if(hasBody(container?.content)){const note=add({kind:'note',id:'container-body',instanceId:instance.id,slotId:slot.id,contentScope:'container'},container.content,{label:strings.note,document:makeDocumentId('container',instance.id,slot.id)});link(slotEntry,note,{priority:-10,order:-1});}
   for(const item of container?.children??[]){if(item.persistence==='runtime')continue;
    if(['knowledge','structure','variable'].includes(item.type))continue;
    const backed=item.targetId?globalContents.get(item.targetId):null;if(backed)usedContents.add(backed.id);
    const content=add({kind:'content',id:item.id,instanceId:instance.id,slotId:slot.id},item,{label:containerItemLabel(item,state),item,contentType:item.type,document:makeDocumentId('content',instance.id,slot.id,item.id),searchText:text(containerItemLabel(item,state),item.content,backed)});link(slotEntry,content,{priority:1,order:item.order,source:'container'});
   }
  }
  const variableGroups=new Map();for(const variable of instance.variables??[]){const type=variable.kind==='derived'?'derived':'inputs';if(!variableGroups.has(type))variableGroups.set(type,group(type,entry,strings[type]));const v=add({kind:'variable',id:variable.id,instanceId:instance.id},variable,{label:variable.displayName??variable.label??variable.id});link(variableGroups.get(type),v,{priority:5,order:variable.order??v.order});}
  if(definition.edges?.length){const relations=group('relations',entry,strings.relations);for(const edge of definition.edges){const e=add({kind:'relation',id:edge.id,instanceId:instance.id},edge,{label:edge.displayLabel||edge.label||edge.relationType||strings.relation,document:makeDocumentId('relation',instance.id,edge.id)});link(relations,e,{priority:-10,order:e.order});}}
  const geometry=[...(instance.geometryPrimitives??[]).map(record=>({record,geometryType:'geometry'})),...(instance.plotExpressions??[]).map(record=>({record,geometryType:'plot'})),...(instance.motionPoints??[]).map(record=>({record,geometryType:'motion'}))];
  if(geometry.length){const g=group('geometry',entry,strings.geometryGroup);for(const {record,geometryType}of geometry){const e=add({kind:'geometry',id:record.id,instanceId:instance.id,geometryType},record,{label:record.label||record.name||strings.geometry});link(g,e,{priority:-10,order:e.order});}}
 }
 // Resolve container references only after every target and slot has an identity.
 for(const instance of sourceInstances.values()){
  const parent=objects.get(navigatorObjectKey({kind:'structure',id:instance.id}));
  for(const [slotId,container]of Object.entries(instance.containers??{}))for(const item of container.children??[]){if(item.persistence==='runtime'||!['knowledge','structure','variable'].includes(item.type))continue;const p=objects.get(navigatorObjectKey({kind:'slot',id:slotId,instanceId:instance.id})),target={kind:item.type,id:item.targetId,...(item.type==='variable'?{instanceId:instance.id}:{})};link(p,objects.get(navigatorObjectKey(target)),{priority:2,order:item.order,reference:mode(item)==='reference',source:'container'});}
  for(const binding of instance.bindings??[]){const p=objects.get(navigatorObjectKey({kind:'slot',id:binding.slotId,instanceId:instance.id})),target={kind:binding.targetType,id:binding.targetId,...(binding.targetType==='variable'?{instanceId:instance.id}:{})};link(p,objects.get(navigatorObjectKey(target)),{priority:3,order:binding.metadata?.order,reference:mode(binding)==='reference',source:'binding'});}
  if(hasBody(instance.objectContent)){const note=add({kind:'note',id:'structure-body',instanceId:instance.id,contentScope:'structure'},instance.objectContent,{label:strings.note});link(parent,note,{priority:-10,order:-1});}
 }
 for(const placement of state.placements??[]){
  const parentKind=placement.parentType==='structure-instance'?'structure':placement.parentType,targetKind=placement.targetType==='structure-instance'?'structure':placement.targetType;
  let parent=objects.get(navigatorObjectKey({kind:parentKind,id:placement.parentId}));
  if(parentKind==='structure'&&placement.path){const slotId=String(placement.path);parent=objects.get(navigatorObjectKey({kind:'slot',instanceId:placement.parentId,id:slotId}));if(!parent){const structure=objects.get(navigatorObjectKey({kind:'structure',id:placement.parentId}));if(structure){parent=add({kind:'slot',id:slotId,instanceId:placement.parentId},{label:slotId},{recovered:true,document:makeDocumentId('container',placement.parentId,slotId)});link(structure,parent,{priority:-10});}}}
  let child=objects.get(navigatorObjectKey({kind:targetKind,id:placement.targetId}));
  if(targetKind==='content'){
   child=[...objects.values()].find(e=>e.kind==='content'&&e.record.targetId===placement.targetId&&e.instanceId===placement.parentId&&e.slotId===String(placement.path??''));
   if(!child&&globalContents.has(placement.targetId)){child=add({kind:'content',id:placement.targetId,contentScope:'global'},globalContents.get(placement.targetId));usedContents.add(placement.targetId);}
  }
  if(!parent||!child){diagnostics.push({type:'unresolved-placement',id:placement.id});continue;}link(parent,child,{priority:0,order:placement.order,reference:mode(placement)==='reference',source:'placement'});
 }
 for(const k of sourceKnowledge.values())if(hasBody(k)){const note=add({kind:'note',id:k.id,knowledgeId:k.id,contentScope:'knowledge'},k,{label:strings.note,document:'notes'});link(knowledgeEntries.get(k.id),note,{priority:-10,order:-1});}
 for(const relation of state.relations??[]){const parent=knowledgeEntries.get(relation.sourceId),r=add({kind:'relation',id:relation.id},relation,{label:relation.displayLabel||relation.label||relation.type||strings.relation,relationScope:'knowledge'});if(parent)link(parent,r,{priority:5,source:'relation-source'});}
 for(const content of globalContents.values())if(!usedContents.has(content.id)){const c=add({kind:'content',id:content.id,contentScope:'global'},content);const owner=knowledgeEntries.get(content.ownerKnowledgeId);if(owner)link(owner,c,{priority:5,source:'content-owner'});}
 for(const board of state.boards??[]){const b=add({kind:'board',id:board.id,knowledgeId:board.ownerKnowledgeId},board),owner=knowledgeEntries.get(board.ownerKnowledgeId);if(owner)link(owner,b,{priority:5});for(const frame of board.frames??[])link(b,objects.get(navigatorObjectKey({kind:'structure',id:frame.instanceId})),{priority:6,order:frame.order,reference:true,source:'board-frame'});}
 for(const edge of links.values())if(!edge.reference){if(!candidates.has(edge.child))candidates.set(edge.child,[]);candidates.get(edge.child).push(edge);}
 const parents=new Map(),chosen=new Map(),sortEdges=(a,b)=>a.priority-b.priority||a.order-b.order||objects.get(a.parent).order-objects.get(b.parent).order;
 for(const[key,edges]of candidates){edges.sort(sortEdges);const preferred=edges[0];parents.set(key,preferred.parent);chosen.set(key,preferred);}
 const declaredRoots=new Set();for(const record of state.knowledgePackages??[]){const found=[record.rootKnowledgeId,record.rootInternalId,record.root?.id].find(id=>knowledgeEntries.has(id));if(found)declaredRoots.add(navigatorObjectKey({kind:'knowledge',id:found}));}
 // Break cycles at a Knowledge boundary when available. Pure structure cycles retain an owner fallback.
 const done=new Set();for(const start of objects.keys()){
  const chain=[],seen=new Map();let current=start;while(current&&parents.has(current)&&!done.has(current)){
   if(seen.has(current)){const cycle=chain.slice(seen.get(current)),cycleSet=new Set(cycle),cut=cycle.find(k=>declaredRoots.has(k))??cycle.find(k=>objects.get(k).kind==='knowledge')??cycle.filter(k=>objects.get(k).kind==='structure').sort((a,b)=>objects.get(a).order-objects.get(b).order)[0]??cycle[0];
    parents.delete(cut);chosen.delete(cut);const fallback=(candidates.get(cut)??[]).find(e=>!cycleSet.has(e.parent)&&e.source==='owner');if(fallback){parents.set(cut,fallback.parent);chosen.set(cut,fallback);}diagnostics.push({type:'ownership-cycle',keys:cycle,cut});break;
   }seen.set(current,chain.length);chain.push(current);current=parents.get(current);
  }for(const key of chain)done.add(key);
 }
 const children=new Map([...objects.keys()].map(key=>[key,[]]));for(const edge of links.values()){
  const canonical=parents.get(edge.child)===edge.parent;if(!canonical&&edge.source==='owner')continue;
  children.get(edge.parent).push({...edge,canonical,reference:!canonical,key:canonical?edge.child:'appearance:'+JSON.stringify([edge.parent,edge.child])});
 }
 for(const entries of children.values())entries.sort((a,b)=>a.order-b.order||objects.get(a.child).order-objects.get(b.child).order);
 const roots=[...objects.values()].filter(e=>!parents.has(e.key)).sort((a,b)=>(declaredRoots.has(a.key)?-1:0)-(declaredRoots.has(b.key)?-1:0)||a.order-b.order);
 const find=target=>{if(typeof target==='string')return objects.get(target)??null;const normalized={...target,kind:target.kind??target.type,id:target.id??target.itemId??(target.kind==='structure'?target.instanceId:undefined)};let found=objects.get(navigatorObjectKey(normalized));if(!found)found=[...objects.values()].find(e=>e.kind===normalized.kind&&e.id===normalized.id&&(normalized.instanceId==null||e.instanceId===normalized.instanceId)&&(normalized.slotId==null||e.slotId===normalized.slotId)&&(normalized.contentScope==null||e.contentScope===normalized.contentScope));return found??null;};
 const pathFor=target=>{const entry=find(target);if(!entry)return null;const keys=[],visited=new Set();let key=entry.key;while(key&&!visited.has(key)){keys.push(key);visited.add(key);key=parents.get(key);}return keys.reverse().map(k=>{const e=objects.get(k);return{kind:e.kind,id:e.id,label:e.label,key:e.key,...(e.instanceId?{instanceId:e.instanceId}:{}),...(e.slotId?{slotId:e.slotId}:{}),...(e.knowledgeId?{knowledgeId:e.knowledgeId}:{}),...(e.document?{document:e.document}:{}),...(e.contentScope?{contentScope:e.contentScope}:{}),...(e.geometryType?{geometryType:e.geometryType}:{})};});};
 const index={objects,definitions,parents,children,roots,diagnostics,find,pathFor,language};return index;
}

export function searchNavigatorIndex(index,query,{limit=200}={}){
 const needle=String(query??'').trim().toLocaleLowerCase();if(!needle)return[];const hits=[];
 for(const entry of index.objects.values()){
  if(entry.synthetic||entry.kind==='note')continue;
  if(!text(entry.label,entry.searchText).toLocaleLowerCase().includes(needle))continue;
  const canonicalPath=index.pathFor(entry);hits.push({kind:entry.kind,id:entry.id,instanceId:entry.instanceId,slotId:entry.slotId,itemId:entry.kind==='content'?entry.id:undefined,contentScope:entry.contentScope,geometryType:entry.geometryType,key:entry.key,label:entry.label,path:canonicalPath.map(s=>s.label),canonicalPath});if(hits.length>=limit)break;
 }return hits;
}

export function revealNavigatorTarget(index,target,expanded=new Set()){
 const path=index.pathFor(target);for(const segment of path??[])expanded.add(segment.key);return path;
}

export function flattenNavigator(index,{expanded=new Set(),query='',maxIndent=3}={}){
 if(String(query).trim())return searchNavigatorIndex(index,query).map(hit=>({...index.find(hit),depth:0,indent:0,reference:false,expandable:false,path:hit.canonicalPath,searchResult:true,meta:hit.path.slice(0,-1).join(' › ')}));
 const rows=[],stack=index.roots.map(entry=>({entry,depth:0,reference:false,rowKey:entry.key})).reverse();
 while(stack.length){const {entry,depth,reference,rowKey}=stack.pop(),childLinks=reference?[]:index.children.get(entry.key)??[],open=expanded.has(entry.key),path=index.pathFor(entry);rows.push({...entry,rowKey,depth,indent:Math.min(depth,maxIndent),reference,expandable:childLinks.length>0,expanded:open,childCount:childLinks.length,path});if(!open)continue;for(let i=childLinks.length-1;i>=0;i--){const e=childLinks[i];stack.push({entry:index.objects.get(e.child),depth:depth+1,reference:e.reference,rowKey:e.key});}}
 return rows;
}
