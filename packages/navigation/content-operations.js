import {buildNavigatorIndex} from './location-index.js';
import {applyDeletionPlan, validateDeletionResult} from '../domain/object-management.js';
import {createContainerContentItem, normalizeObjectContent, synchronizeBindingContent} from '../domain/semantic-container.js';
import {materializeInstanceDefinition, bindTarget, removeInstanceEdge} from '../structure-engine/model.js';
import {containerCapabilities, edgeCapabilities} from '../structure-engine/interaction-adapters.js';

const stores = Object.freeze({knowledge:'knowledge', structure:'structureInstances', content:'contentObjects', board:'boards'});
const clone = value => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `content-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const typeOf = value => value === 'structure-instance' ? 'structure' : value === 'formula' ? 'content' : value;
const modeOf = value => (value?.mode ?? value?.metadata?.placementMode) === 'reference' ? 'reference' : 'construct';
const entityKey = (kind,id) => JSON.stringify([typeOf(kind),id]);
const isGlobal = entry => !!stores[entry.kind] && (entry.kind !== 'content' || entry.contentScope === 'global');
const targetOf = entry => ({kind:entry.kind,id:entry.id,...(entry.instanceId?{instanceId:entry.instanceId}:{}),...(entry.slotId?{slotId:entry.slotId}:{}),...(entry.contentScope?{contentScope:entry.contentScope}:{}),...(entry.knowledgeId?{knowledgeId:entry.knowledgeId}:{}),...(entry.geometryType?{geometryType:entry.geometryType}:{})});
const instanceOf = (state,id) => (state.structureInstances??[]).find(item=>item.id===id);
const recordOf = (state,entry) => (state[stores[entry.kind]]??[]).find(item=>item.id===entry.id);
const failure = (code,message) => Object.assign(new Error(message),{code});

function capabilitiesFor(state,entry) {
  if (entry.synthetic || entry.kind === 'slot') return {move:false,copy:false,delete:false};
  if (isGlobal(entry) || entry.kind === 'content' || entry.kind === 'note') return {move:true,copy:true,delete:true};
  if (entry.kind === 'relation') {
    if (!entry.instanceId) return {move:false,copy:false,delete:true};
    const instance=instanceOf(state,entry.instanceId), template=(state.structureTemplates??[]).find(item=>item.id===instance?.templateId);
    return {move:false,copy:false,delete:!!edgeCapabilities(template,entry.record,instance).canDeleteCanonicalObject};
  }
  // Variables, slots and geometry have model-specific dependency rules and remain
  // editable through their dedicated structure tools, never as free-standing files.
  return {move:false,copy:false,delete:false};
}

/** A shared inventory for context menus, address selection and multi-type deletion. */
export function listContentEntries(state,options={}) {
  const index=buildNavigatorIndex(state,options);
  return [...index.objects.values()].filter(entry=>!entry.synthetic).map(entry=>{
    const capabilities=capabilitiesFor(state,entry);
    const live=entry.kind==='content'&&entry.instanceId?instanceOf(state,entry.instanceId)?.containers?.[entry.slotId]?.children?.find(item=>item.id===entry.id):entry.record;
    return {...entry,record:live??entry.record,...(entry.item?{item:live??entry.item}:{}),title:entry.label,type:entry.kind,target:targetOf(entry),capabilities,
      canMove:capabilities.move,canCopy:capabilities.copy,canDelete:capabilities.delete,
      path:index.pathFor(entry),unassigned:entry.kind!=='knowledge'&&!index.parents.has(entry.key)};
  });
}

/** Address picker data. The transaction checks destination types and capacity
 * again when applied; a stale picker can never overwrite a populated node. */
export function listContentDestinations(state,{targets=[],operation='move',language='zh-CN'}={}) {
  const index=buildNavigatorIndex(state,{language}),selected=targets.length?selectEntries(index,targets):[];
  const excluded=operation==='move'?new Set(ownedEntries(index,selected).map(entry=>entry.key)):new Set();
  const label=language==='en'?'Content Library':'内容库';
  const result=[{kind:'root',id:'root',key:'content-library-root',label,target:{kind:'root'},path:[]}];
  for(const entry of index.objects.values()) {
    if(excluded.has(entry.key)||!['knowledge','slot'].includes(entry.kind))continue;
    if(entry.kind==='slot') {
      const instance=instanceOf(state,entry.instanceId),template=(state.structureTemplates??[]).find(item=>item.id===instance?.templateId),caps=containerCapabilities(template,entry.record,instance);
      if(!caps.canAddKnowledge&&!caps.canAddStructure&&!caps.canAddLocalContent)continue;
    }
    result.push({...targetOf(entry),key:entry.key,label:entry.label,target:targetOf(entry),path:index.pathFor(entry)});
  }
  return result;
}

function selectEntries(index,targets) {
  const entries=new Map();
  for (const target of Array.isArray(targets)?targets:[targets]) {
    const normalized=target?.target??target;
    const entry=index.find(typeof normalized==='string'?normalized:{...normalized,kind:normalized?.kind??normalized?.type,id:normalized?.id??normalized?.targetId??normalized?.itemId});
    if (!entry) throw failure('missing-source','内容不存在或地址已经改变，请刷新后重试。');
    entries.set(entry.key,entry);
  }
  if (!entries.size) throw failure('missing-source','请选择要操作的内容。');
  // Selecting a folder and its descendants is one operation, not two copies.
  return [...entries.values()].filter(entry=>{
    let parent=index.parents.get(entry.key);
    while(parent){if(entries.has(parent))return false;parent=index.parents.get(parent);}
    return true;
  });
}

function ownedEntries(index,roots) {
  const selected=new Set(),queue=roots.map(entry=>entry.key);
  while(queue.length) {
    const key=queue.shift();if(selected.has(key))continue;selected.add(key);
    for(const edge of index.children.get(key)??[])if(edge.canonical&&!edge.reference)queue.push(edge.child);
  }
  return [...selected].map(key=>index.objects.get(key));
}

function globalMembers(state,index,roots) {
  const members=new Map();
  for(const entry of ownedEntries(index,roots)) {
    if(isGlobal(entry))members.set(entityKey(entry.kind,entry.id),entry);
    // An archived content object can be displayed through its container item.
    if(entry.kind==='content'&&entry.record.targetId&&modeOf(entry.record)==='construct') {
      const backed=(state.contentObjects??[]).find(item=>item.id===entry.record.targetId);
      if(backed)members.set(entityKey('content',backed.id),{kind:'content',id:backed.id,contentScope:'global',record:backed});
    }
  }
  return members;
}

function resolveDestination(state,index,destination) {
  if(!destination || destination.kind==='root' || destination.type==='root')return {kind:'root'};
  let normalized={...destination,kind:destination.kind??destination.type};
  if(normalized.kind==='slot')normalized.id??=normalized.slotId;
  const entry=index.find(normalized);
  if(!entry || !['knowledge','slot'].includes(entry.kind))throw failure('invalid-destination','目标地址必须是内容库根目录、知识或结构中的节点。');
  return targetOf(entry);
}

function assertDestinationOutside(index,roots,destination) {
  if(destination.kind==='root')return;
  const destinationEntry=index.find(destination),owned=new Set(ownedEntries(index,roots).map(entry=>entry.key));
  if(owned.has(destinationEntry.key))throw failure('ownership-cycle','不能把内容移动到自身或自己的后代中。');
}

function nearestKnowledge(state,destination) {
  if(destination.kind==='knowledge')return destination.id;
  if(destination.kind==='root')return null;
  const index=buildNavigatorIndex(state),path=index.pathFor({...destination,id:destination.id??destination.slotId});
  return [...(path??[])].reverse().find(entry=>entry.kind==='knowledge')?.id??null;
}

function detachEntity(state,entry) {
  const matches=(type,id)=>typeOf(type)===entry.kind&&id===entry.id;
  state.placements=(state.placements??[]).filter(item=>modeOf(item)==='reference'||!matches(item.targetType,item.targetId));
  for(const instance of state.structureInstances??[]) {
    instance.bindings=(instance.bindings??[]).filter(binding=>modeOf(binding)==='reference'||!matches(binding.targetType,binding.targetId));
    for(const container of Object.values(instance.containers??{})) {
      container.children=(container.children??[]).filter(item=>modeOf(item)==='reference'||!matches(item.type,item.targetId));
      container.children.forEach((item,order)=>{item.order=order;});
    }
    synchronizeBindingContent(instance);
  }
  const record=recordOf(state,entry);
  if(record&&'ownerKnowledgeId' in record)record.ownerKnowledgeId=null;
}

function placement(state,entry,destination) {
  if(destination.kind==='root')return;
  state.placements??=[];
  const siblings=state.placements.filter(item=>item.parentId===(destination.instanceId??destination.id)&&String(item.path??'')===String(destination.slotId??''));
  state.placements.push({id:uid(),targetType:entry.kind,targetId:entry.id,parentType:destination.kind==='slot'?'structure':'knowledge',parentId:destination.instanceId??destination.id,path:destination.kind==='slot'?destination.slotId??destination.id:undefined,mode:'construct',order:siblings.length});
}

function slotDestination(state,destination,entry) {
  const instance=instanceOf(state,destination.instanceId),template=(state.structureTemplates??[]).find(item=>item.id===instance?.templateId);
  if(!instance||!template)throw failure('invalid-destination','目标结构或模板不存在。');
  const definition=materializeInstanceDefinition(template,instance),slot=definition.slots.find(item=>item.id===(destination.slotId??destination.id));
  if(!slot)throw failure('invalid-destination','目标节点不存在。');
  const capabilities=containerCapabilities(template,slot,instance);
  const accepted=entry.kind==='board'?false:entry.kind==='content'?capabilities.canAddLocalContent:slot.accepts?.includes(entry.kind)&&capabilities[entry.kind==='knowledge'?'canAddKnowledge':'canAddStructure'];
  if(!accepted)throw failure('unsupported-content-type','目标节点不接受这一类型的内容。');
  const children=instance.containers?.[slot.id]?.children??[];
  const occupied=children.filter(item=>item.persistence!=='runtime'&&(item.targetId||item.content));
  if(slot.cardinality==='one'&&occupied.length)throw failure('occupied-destination','目标节点只能容纳一项内容且已经被占用，请选择其他地址。');
  return {instance,template,slot};
}

function refreshOwners(state,members) {
  const index=buildNavigatorIndex(state);
  for(const entry of members) {
    if(!['structure','content','board'].includes(entry.kind))continue;
    const record=recordOf(state,entry);if(!record)continue;
    const located=index.find(entry)??(entry.kind==='content'?[...index.objects.values()].find(item=>item.kind==='content'&&item.record.targetId===entry.id&&modeOf(item.record)==='construct'):null);
    const path=located?index.pathFor(located):null,owner=[...(path??[])].reverse().find(segment=>segment.kind==='knowledge')?.id??null;
    record.ownerKnowledgeId=owner;
    if(entry.kind==='structure')for(const representation of state.representations??[])if((representation.instanceId??representation.data?.instanceId??representation.settings?.instanceId)===entry.id)representation.knowledgeId=owner;
  }
}

function placeEntity(state,entry,destination) {
  const record=recordOf(state,entry);if(!record)throw failure('missing-source','内容已经不存在。');
  if(destination.kind==='slot') {
    const {instance,template,slot}=slotDestination(state,destination,entry);
    if(['knowledge','structure'].includes(entry.kind))bindTarget(instance,template,slot.id,entry.kind,entry.id,{placementMode:'construct'});
    else {
      const content=normalizeObjectContent(record.objectContent??record,{title:record.title,body:record.body});
      instance.containers[slot.id].children.push(createContainerContentItem('content',{targetId:entry.id,content,order:instance.containers[slot.id].children.length,metadata:{placementMode:'construct'}}));
    }
  }
  placement(state,entry,destination);
  if(entry.kind!=='knowledge')record.ownerKnowledgeId=nearestKnowledge(state,destination);
  record.updatedAt=new Date().toISOString();
}

function noteRecord(state,entry) {
  if(entry.contentScope==='knowledge')return (state.knowledge??[]).find(item=>item.id===(entry.knowledgeId??entry.id));
  const instance=instanceOf(state,entry.instanceId);
  return entry.contentScope==='structure'?instance?.objectContent:instance?.containers?.[entry.slotId]?.content;
}

function clearNote(state,entry) {
  const record=noteRecord(state,entry);if(!record)return;
  for(const field of ['body','summary','latex','displayFormula'])if(field in record)record[field]='';
  if(typeof record.content==='string')record.content='';
  if(record.objectContent)for(const field of ['body','summary','displayFormula'])record.objectContent[field]='';
  if(record.objectContent?.images)record.objectContent.images=[];
  if(record.images)record.images=[];
}

/** Promote a local note to a normal archive so it remains usable without a Knowledge. */
function promoteContent(state,entry,{copy=false}={}) {
  let original,content,title=entry.label;
  if(entry.kind==='note') {
    original=noteRecord(state,entry);content=normalizeObjectContent(original?.objectContent??original,{body:typeof original?.content==='string'?original.content:original?.body,title:original?.title});
    title=original?.title||content.title||entry.label;
    if(!copy)clearNote(state,entry);
  } else {
    const container=instanceOf(state,entry.instanceId)?.containers?.[entry.slotId];
    original=container?.children?.find(item=>item.id===entry.id);
    if(!original)throw failure('missing-source','正文的原始地址已经不存在。');
    const backed=(state.contentObjects??[]).find(item=>item.id===original.targetId);
    content=normalizeObjectContent(backed?.objectContent??original.content??backed??{}, {title:entry.label});
    title=backed?.title||content.title||entry.label;
    if(!copy){container.children=container.children.filter(item=>item.id!==entry.id);container.children.forEach((item,order)=>{item.order=order;});}
    if(backed&&!copy&&modeOf(original)==='construct') {
      const global={kind:'content',id:backed.id,contentScope:'global'};detachEntity(state,global);return global;
    }
  }
  const record={id:uid(),title,body:content.body,contentType:content.contentType,objectContent:content,ownerKnowledgeId:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  state.contentObjects??=[];state.contentObjects.push(record);
  return {kind:'content',id:record.id,contentScope:'global'};
}

function clearCopyIdentity(record,source) {
  record.id=uid();record.metadata={...(record.metadata??{}),copiedFrom:{id:source.id,...(source.packageId?{packageId:source.packageId}:{}),...(source.stableId?{stableId:source.stableId}:{})}};
  delete record.packageId;delete record.stableId;delete record.externalStableId;
  if(record.objectContent)record.objectContent.externalKey=null;
  record.createdAt=new Date().toISOString();record.updatedAt=record.createdAt;
  return record;
}

function cloneEntities(state,index,roots) {
  const members=globalMembers(state,index,roots),mapping=new Map(),copies=new Map();
  for(const [key,entry]of members) {
    const source=recordOf(state,entry),copy=clearCopyIdentity(clone(source),source);
    mapping.set(key,copy.id);copies.set(key,{entry,source,copy});
  }
  const mapped=(kind,id)=>mapping.get(entityKey(kind,id))??id;
  for(const {entry,source,copy}of copies.values()) {
    if('ownerKnowledgeId'in copy)copy.ownerKnowledgeId=mapping.get(entityKey('knowledge',copy.ownerKnowledgeId))??null;
    if(entry.kind==='structure') {
      copy.bindings=(copy.bindings??[]).map(binding=>({...binding,id:uid(),externalStableId:undefined,instanceId:copy.id,targetId:mapped(binding.targetType,binding.targetId),metadata:{...(binding.metadata??{}),placementStableId:undefined}}));
      for(const container of Object.values(copy.containers??{}))container.children=(container.children??[]).filter(item=>item.metadata?.compatibilitySource!=='binding').map(item=>({...item,id:uid(),targetId:item.targetId?mapped(item.type,item.targetId):null,content:item.content?{...item.content,externalKey:null}:null,metadata:{...(item.metadata??{}),externalStableId:undefined,placementStableId:undefined}}));
      // Variable names are scoped by the new instance. Keep expressions and names
      // intact while dropping old package-global declarations and provenance IDs.
      for(const variable of copy.variables??[]){delete variable.externalStableId;delete variable.ownerStableRef;variable.declarationScope='instance';}
      delete copy.ownerKnowledgeStableRef;
      copy.objectHistory=[];
      synchronizeBindingContent(copy);
    }
    if(entry.kind==='board')copy.frames=(copy.frames??[]).map(frame=>({...frame,id:uid(),stableId:undefined,externalStableId:undefined,instanceId:mapped('structure',frame.instanceId)}));
    state[stores[entry.kind]]??=[];state[stores[entry.kind]].push(copy);
  }
  for(const source of [...(state.placements??[])]) {
    const parentKey=entityKey(source.parentType,source.parentId),targetKey=entityKey(source.targetType,source.targetId);
    if(!mapping.has(parentKey)||(!mapping.has(targetKey)&&modeOf(source)!=='reference'))continue;
    state.placements.push({...clearCopyIdentity(clone(source),source),parentId:mapping.get(parentKey),targetId:mapped(source.targetType,source.targetId)});
  }
  for(const source of [...(state.relations??[])])if(mapping.has(entityKey('knowledge',source.sourceId)))state.relations.push({...clearCopyIdentity(clone(source),source),sourceId:mapped('knowledge',source.sourceId),targetId:mapped('knowledge',source.targetId)});
  for(const source of [...(state.structureViews??[])])if(mapping.has(entityKey('structure',source.instanceId)))state.structureViews.push({...clearCopyIdentity(clone(source),source),instanceId:mapped('structure',source.instanceId),forId:mapped(typeOf(source.forType??'structure'),source.forId)});
  for(const source of [...(state.representations??[])]) {
    const instanceId=source.instanceId??source.data?.instanceId??source.settings?.instanceId;
    if(!mapping.has(entityKey('structure',instanceId)))continue;
    const copy=clearCopyIdentity(clone(source),source);copy.knowledgeId=mapping.get(entityKey('knowledge',source.knowledgeId))??null;
    if(copy.instanceId)copy.instanceId=mapped('structure',copy.instanceId);
    if(copy.data?.instanceId)copy.data.instanceId=mapped('structure',copy.data.instanceId);
    if(copy.settings?.instanceId)copy.settings.instanceId=mapped('structure',copy.settings.instanceId);
    state.representations.push(copy);
  }
  return {roots:roots.map(entry=>({...targetOf(entry),id:mapped(entry.kind,entry.id)})),members:[...copies.values()].map(({entry,copy})=>({...targetOf(entry),id:copy.id})),mapping};
}

function removalPlan(state,members) {
  const ids={knowledge:[],structures:[],content:[],boards:[],templates:[]};
  for(const entry of members.values())ids[{knowledge:'knowledge',structure:'structures',content:'content',board:'boards'}[entry.kind]].push(entry.id);
  const has=(kind,id)=>members.has(entityKey(kind,id));
  const deletedRecords=[...members.values()].map(entry=>recordOf(state,entry));
  const packageRecords=(state.knowledgePackages??[]).filter(record=>ids.knowledge.includes(record.rootKnowledgeId??record.rootInternalId)||(record.root?.type==='knowledge'&&deletedRecords.some(item=>item?.id===record.root.id||item?.stableId===record.root.id&&item?.packageId===(record.packageId??record.stableId??record.id)))).map(record=>record.id);
  const entriesToDelete=[];
  for(const record of state.knowledgePackages??[])for(const entry of record.entries??[]) {
    const id=entry.target?.id??entry.knowledge??entry.structure??entry.content??entry.board;
    if(id&&deletedRecords.some(item=>item?.id===id||item?.stableId===id&&item?.packageId===(record.packageId??record.stableId??record.id)))entriesToDelete.push({packageRecordId:record.id,entryId:entry.id??entry.stableId??String(id)});
  }
  const placementsToDelete=(state.placements??[]).filter(item=>has(item.targetType,item.targetId)||has(item.parentType,item.parentId)).map(item=>item.id);
  const relationsToDelete=(state.relations??[]).filter(item=>has('knowledge',item.sourceId)||has('knowledge',item.targetId)).map(item=>item.id);
  const viewsToDelete=(state.structureViews??[]).filter(item=>has('structure',item.instanceId)||has(item.forType??'structure',item.forId)).map(item=>item.id);
  const representationsToDelete=(state.representations??[]).filter(item=>has('knowledge',item.knowledgeId)||has('structure',item.instanceId??item.data?.instanceId??item.settings?.instanceId)).map(item=>item.id);
  return {allObjectKeys:[...members.values()].map(entry=>`${entry.kind}:${entry.id}`),objectsToDelete:ids,packageIds:[],packageRecords,entriesToDelete,placementsToDelete,relationsToDelete,viewsToDelete,representationsToDelete};
}

function deleteContent(state,index,entries) {
  const members=globalMembers(state,index,entries),plan=removalPlan(state,members);
  let removedLocal=0;
  for(const entry of entries.filter(entry=>!isGlobal(entry))) {
    if(entry.kind==='note'){clearNote(state,entry);removedLocal++;}
    else if(entry.kind==='content') {
      const instance=instanceOf(state,entry.instanceId),container=instance?.containers?.[entry.slotId],item=container?.children?.find(item=>item.id===entry.id);
      if(!item)throw failure('missing-source','正文的原始地址已经不存在。');
      container.children=container.children.filter(item=>item.id!==entry.id);
      container.children.forEach((item,order)=>{item.order=order;});
      state.placements=(state.placements??[]).filter(p=>!(p.parentId===entry.instanceId&&p.path===entry.slotId&&typeOf(p.targetType)==='content'&&p.targetId===item.targetId));
      if(!members.has(entityKey('content',item.targetId)))removedLocal++;
    } else if(entry.kind==='relation') {
      if(entry.instanceId)removeInstanceEdge(instanceOf(state,entry.instanceId),entry.id);
      else state.relations=(state.relations??[]).filter(relation=>relation.id!==entry.id);
      removedLocal++;
    }
  }
  for(const board of state.boards??[])if(!plan.objectsToDelete.boards.includes(board.id)&&plan.objectsToDelete.knowledge.includes(board.ownerKnowledgeId))board.ownerKnowledgeId=null;
  applyDeletionPlan(state,plan);
  // Old workspaces can carry a redundant owner hint in addition to their real
  // construct location. Preserve surviving content and remove only that hint.
  for(const store of ['structureInstances','contentObjects','boards'])for(const record of state[store]??[])if(plan.objectsToDelete.knowledge.includes(record.ownerKnowledgeId))record.ownerKnowledgeId=null;
  return {members:[...members.values()],affected:members.size+removedLocal,plan};
}

function validateNewState(before,after) {
  const existing=new Set(validateDeletionResult(before).errors);
  const introduced=validateDeletionResult(after).errors.filter(error=>!existing.has(error));
  for(const [kind,store]of Object.entries(stores)) {
    const ids=new Set();for(const record of after[store]??[]){if(ids.has(record.id))introduced.push(`duplicate ${kind} ID ${record.id}`);ids.add(record.id);}
  }
  const previousCycles=new Set(buildNavigatorIndex(before).diagnostics.filter(item=>item.type==='ownership-cycle').map(item=>JSON.stringify([...item.keys].sort())));
  for(const diagnostic of buildNavigatorIndex(after).diagnostics)if(diagnostic.type==='ownership-cycle'&&!previousCycles.has(JSON.stringify([...diagnostic.keys].sort())))introduced.push('ownership cycle');
  if(introduced.length)throw failure('invalid-result',`操作会产生无效引用，已取消且未修改原内容：${introduced[0]}`);
}

/** Prepare the entire transaction on a clone; callers replace state once inside
 * their undo-aware commit. A failed destination or validation never partly moves. */
function prepareOperation(source,{operation,targets,destination,language='zh-CN'}={}) {
  if(!['move','copy','delete'].includes(operation))throw failure('unsupported-operation','未知的内容操作。');
  const state=clone(source),index=buildNavigatorIndex(state,{language}),entries=selectEntries(index,targets);
  for(const entry of entries)if(!capabilitiesFor(state,entry)[operation])throw failure('unsupported-operation','这一项是结构的内部组成部分，请使用该结构的专用编辑工具。');
  const warnings=[];let resultTargets=[],affected=entries.length,members=[];
  if(operation==='delete') {
    const result=deleteContent(state,index,entries);affected=result.affected;members=result.members;
    const deletedIds=new Set(result.plan.objectsToDelete.knowledge);
    const external=(source.relations??[]).filter(relation=>deletedIds.has(relation.sourceId)!==deletedIds.has(relation.targetId));
    if(external.length)warnings.push(language==='en'?`${external.length} relations to deleted content will be removed.`:`将清理 ${external.length} 条指向已删除内容的关系。`);
  } else {
    const resolved=resolveDestination(state,index,destination);
    if(operation==='move')assertDestinationOutside(index,entries,resolved);
    const globalRoots=entries.filter(isGlobal),localRoots=entries.filter(entry=>!isGlobal(entry));
    if(operation==='copy') {
      const copied=cloneEntities(state,index,globalRoots);resultTargets=copied.roots;members=copied.members;
      for(const entry of localRoots){const promoted=promoteContent(state,entry,{copy:true});resultTargets.push(promoted);members.push(promoted);}
    } else {
      members=[...globalMembers(state,index,globalRoots).values()];
      for(const entry of globalRoots){detachEntity(state,entry);resultTargets.push(targetOf(entry));}
      for(const entry of localRoots){const promoted=promoteContent(state,entry);resultTargets.push(promoted);members.push(promoted);}
    }
    for(const entry of resultTargets)placeEntity(state,entry,resolved);
    refreshOwners(state,members);
    affected=members.length;
    // Return the actual container item target when an archive is displayed there.
    const finalIndex=buildNavigatorIndex(state,{language});
    resultTargets=resultTargets.map(target=>{
      const found=finalIndex.find(target)??[...finalIndex.objects.values()].find(entry=>entry.kind==='content'&&entry.record.targetId===target.id&&entry.instanceId===resolved.instanceId&&entry.slotId===(resolved.slotId??resolved.id));
      return found?targetOf(found):target;
    });
  }
  validateNewState(source,state);
  const counts={knowledge:0,structures:0,content:0,boards:0,relations:0};
  for(const entry of members)counts[{knowledge:'knowledge',structure:'structures',content:'content',board:'boards'}[entry.kind]]++;
  if(operation==='delete') {
    counts.relations=(source.relations??[]).length-(state.relations??[]).length+entries.filter(entry=>entry.kind==='relation'&&entry.instanceId).length;
    counts.content+=entries.filter(entry=>entry.kind==='note'||entry.kind==='content'&&!isGlobal(entry)&&!members.some(member=>member.kind==='content'&&member.id===entry.record.targetId)).length;
  }
  return {state,targets:resultTargets,summary:{requested:entries.length,affected,counts},warnings};
}

const englishErrors={
  'missing-source':'The content no longer exists at this address. Refresh and try again.',
  'invalid-destination':'Choose the Content Library root, a Knowledge, or a structure node as the destination.',
  'ownership-cycle':'Content cannot be moved into itself or one of its descendants.',
  'unsupported-content-type':'The destination node does not accept this content type.',
  'occupied-destination':'The destination accepts one item and is already occupied. Choose another address.',
  'unsupported-operation':'This item belongs to a structure. Use that structure’s dedicated editing tools.',
  'invalid-result':'The operation would create an invalid reference and was canceled. Your original content has not changed.'
};

export function prepareContentOperation(source,options={}) {
  try{return prepareOperation(source,options);}
  catch(error){if(options.language==='en'&&englishErrors[error.code])error.message=englishErrors[error.code];throw error;}
}
