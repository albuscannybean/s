const uid=()=>globalThis.crypto?.randomUUID?.()??`container-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone=value=>structuredClone(value);

export const CONTAINER_CONTENT_TYPES=Object.freeze(['knowledge','structure','content','variable','formula','link','attachment']);
export const OBJECT_CONTENT_TYPES=Object.freeze(['note','definition','theorem','proof','example','counterexample','formula','reference','custom']);
export const DIRECT_NAVIGABLE_CONTAINER_TYPES=Object.freeze(['knowledge','structure','content','formula']);

const CONTAINER_ITEM_FALLBACK_LABELS=Object.freeze({knowledge:'知识',structure:'结构',content:'正文',variable:'变量',formula:'公式',link:'链接',attachment:'附件'});

export const DEFAULT_OBJECT_CAPABILITIES=Object.freeze({
  canRenameDisplayLabel:true,
  canEditSemanticRole:true,
  canMoveVisualPosition:true,
  canMoveSemanticPosition:true,
  canChangeEndpoints:true,
  canChangeDirection:true,
  canChangeRelationType:true,
  canDeleteCanonicalObject:true,
  canEditAppearance:true,
  canEditContent:true,
  canAddKnowledge:true,
  canAddStructure:true,
  canAddLocalContent:true,
  canAddVariable:true,
  canAddFormula:true,
  canAddRelation:true
});
export const DEFAULT_CONTAINER_CAPABILITIES=DEFAULT_OBJECT_CAPABILITIES;

export function normalizeObjectCapabilities(value={}){return Object.freeze({...DEFAULT_OBJECT_CAPABILITIES,...value})}

export function normalizeObjectContent(value={},fallback={}){
  const source=typeof value==='string'?{body:value}:value??{};
  const contentType=OBJECT_CONTENT_TYPES.includes(source.contentType)?source.contentType:(fallback.contentType??'note');
  return{
    title:String(source.title??fallback.title??''),
    summary:String(source.summary??fallback.summary??''),
    body:String(source.body??fallback.body??''),
    displayFormula:String(source.displayFormula??fallback.displayFormula??''),
    bodyFormat:'markdown',
    contentType,
    tags:Array.isArray(source.tags)?source.tags.map(String):[],
    sources:Array.isArray(source.sources)?clone(source.sources):[],
    links:Array.isArray(source.links)?clone(source.links):[],
    externalKey:source.externalKey??fallback.externalKey??null,
    aiMetadata:source.aiMetadata?clone(source.aiMetadata):fallback.aiMetadata?clone(fallback.aiMetadata):null
  };
}

export function ensureObjectContent(object,{legacyBody='',legacySummary='',contentType='note'}={}){
  if(!object)return normalizeObjectContent();
  const existing=object.objectContent??(object.content&&typeof object.content==='object'?object.content:null);
  object.objectContent=normalizeObjectContent(existing??{}, {
    title:object.title??object.label??object.name??'',
    summary:object.summary??legacySummary??object.metadata?.description??'',
    body:typeof object.content==='string'?object.content:legacyBody??object.metadata?.note??object.note??'',
    contentType
  });
  return object.objectContent;
}

export function createContainerContentItem(type,options={}){
  if(!CONTAINER_CONTENT_TYPES.includes(type))throw new Error(`Unsupported container content type: ${type}`);
  return{
    id:options.id??uid(),
    type,
    targetId:options.targetId??null,
    content:options.content?normalizeObjectContent(options.content):null,
    order:Number.isFinite(Number(options.order))?Number(options.order):0,
    persistence:options.persistence==='runtime'?'runtime':'persistent',
    metadata:clone(options.metadata??{})
  };
}

export function normalizeContainerContentItem(item,index=0){
  return createContainerContentItem(item.type,{...item,id:item.id??uid(),order:item.order??index});
}

export function normalizeContainerStore(instance,definition=null){
  instance.containers??={};
  for(const [slotId,raw] of Object.entries(instance.containers))instance.containers[slotId]=normalizeStoredContainer(slotId,raw);
  for(const slot of definition?.slots??[])ensureSemanticContainer(instance,slot);
  migrateLegacySlotNotes(instance,definition);
  synchronizeBindingContent(instance);
  ensureObjectContent(instance,{contentType:'custom'});
  for(const variable of instance.variables??[])ensureObjectContent(variable,{legacySummary:variable.metadata?.description??'',contentType:'custom'});
  for(const patch of Object.values(instance.overrides?.edgePatches??{}))ensureObjectContent(patch,{legacyBody:patch.metadata?.note??patch.note??'',contentType:'custom'});
  return instance.containers;
}

function normalizeStoredContainer(slotId,raw={}){
  return{
    id:raw.id??slotId,
    localDisplayTitle:String(raw.localDisplayTitle??raw.displayTitle??''),
    label:raw.label??'',
    role:raw.role??'',
    semanticCoordinate:clone(raw.semanticCoordinate??{}),
    content:normalizeObjectContent(raw.content??{}, {title:raw.label??''}),
    children:(raw.children??[]).map(normalizeContainerContentItem),
    capabilities:raw.capabilities?{...DEFAULT_OBJECT_CAPABILITIES,...raw.capabilities}:null,
    visual:clone(raw.visual??{})
  };
}

export function ensureSemanticContainer(instance,slot,capabilities=null){
  instance.containers??={};
  const stored=instance.containers[slot.id]=normalizeStoredContainer(slot.id,instance.containers[slot.id]);
  stored.label=slot.label??stored.label;
  stored.role=slot.role??stored.role;
  stored.semanticCoordinate=clone(slot.semanticCoordinate??stored.semanticCoordinate);
  stored.content.title||=slot.label??slot.id;
  if(capabilities)stored.capabilities={...DEFAULT_OBJECT_CAPABILITIES,...capabilities};
  return stored;
}

export function getSemanticContainer(instance,slotId,definition=null){
  const slot=definition?.slots?.find(item=>item.id===slotId)??{id:slotId,label:slotId,role:'container'};
  return ensureSemanticContainer(instance,slot);
}

export function addContainerContent(instance,slotId,item,definition=null){
  const container=getSemanticContainer(instance,slotId,definition),normalized=normalizeContainerContentItem({...item,order:item.order??container.children.length});
  container.children.push(normalized);return normalized;
}

export function updateContainerContent(instance,slotId,itemId,patch,definition=null){
  const container=getSemanticContainer(instance,slotId,definition),index=container.children.findIndex(item=>item.id===itemId);if(index<0)throw new Error(`Unknown container content ${itemId}`);
  container.children[index]=normalizeContainerContentItem({...container.children[index],...clone(patch),id:itemId},index);return container.children[index];
}

export function removeContainerContent(instance,slotId,itemId){
  const container=instance.containers?.[slotId];if(!container)return null;const item=container.children.find(current=>current.id===itemId);container.children=container.children.filter(current=>current.id!==itemId);return item??null;
}

export function clearContainerContent(instance,slotId,{includeCompatibility=true}={}){
  const container=instance.containers?.[slotId];if(!container)return[];const removed=container.children.filter(item=>includeCompatibility||item.metadata?.compatibilitySource!=='binding');container.children=container.children.filter(item=>!removed.includes(item));return removed;
}

export function removeSemanticContainer(instance,slotId){if(instance.containers)delete instance.containers[slotId]}

export function synchronizeBindingContent(instance){
  instance.containers??={};
  for(const container of Object.values(instance.containers))container.children=(container.children??[]).filter(item=>item.metadata?.compatibilitySource!=='binding');
  for(const binding of instance.bindings??[]){
    const container=getSemanticContainer(instance,binding.slotId);
    container.children.push(createContainerContentItem(binding.targetType,{id:`binding:${binding.id}`,targetId:binding.targetId,order:container.children.length,persistence:'persistent',metadata:{compatibilitySource:'binding',bindingId:binding.id,...clone(binding.metadata??{})}}));
  }
  return instance.containers;
}

function migrateLegacySlotNotes(instance,definition){
  const noteSources=[instance.slotNotes,instance.metadata?.slotNotes].filter(Boolean);
  for(const source of noteSources)for(const [slotId,note] of Object.entries(source))addLegacyNote(instance,slotId,note,definition);
  for(const [slotId,patch] of Object.entries(instance.overrides?.slotPatches??{})){const note=patch.note??patch.metadata?.note;if(note)addLegacyNote(instance,slotId,note,definition)}
}

function addLegacyNote(instance,slotId,note,definition){
  const container=getSemanticContainer(instance,slotId,definition),id=`legacy-note:${slotId}`;if(container.children.some(item=>item.id===id))return;
  container.children.push(createContainerContentItem('content',{id,content:typeof note==='string'?{title:'正文',body:note,contentType:'note'}:note,order:container.children.length,metadata:{compatibilitySource:'legacy-note'}}));
}

export function migrateStateContentModels(state,resolveDefinition=()=>null){
  for(const knowledge of state.knowledge??[])ensureObjectContent(knowledge,{contentType:'note'});
  for(const relation of state.relations??[])ensureObjectContent(relation,{legacyBody:relation.body??relation.metadata?.note??'',contentType:'custom'});
  for(const instance of state.structureInstances??[])normalizeContainerStore(instance,resolveDefinition(instance));
  return state;
}

export function buildPositionIndex(instance,definition,{capabilitiesForSlot=null}={}){
  normalizeContainerStore(instance,definition);const bySlotId={};
  for(const slot of definition.slots){const container=ensureSemanticContainer(instance,slot,capabilitiesForSlot?.(slot)),persistentChildren=container.children.filter(item=>item.persistence!=='runtime').map(clone);bySlotId[slot.id]={container,persistentChildren,runtimeChildren:[],children:[...persistentChildren]}}
  const modulus=Number(instance.parameters?.modulus??definition.slots.length)||definition.slots.length;
  const modularSlots=new Map(definition.slots.filter(slot=>slot.semanticCoordinate?.modularIndex!=null).map(slot=>[Number(slot.semanticCoordinate.modularIndex),slot.id]));
  for(const variable of instance.variables??[]){
    const result=instance.runtimeState?.results?.[variable.id]??instance.runtimeState?.variables?.[variable.id]??variable.value;if(result==null||!Number.isFinite(Number(result))||!modularSlots.size)continue;
    const position=((Number(result)%modulus)+modulus)%modulus,slotId=modularSlots.get(position);if(!slotId||!bySlotId[slotId])continue;
    const runtime=createContainerContentItem('variable',{id:`runtime-variable:${variable.id}`,targetId:variable.id,persistence:'runtime',content:{title:variable.displayName??variable.label??'变量',summary:'',contentType:'custom'},metadata:{label:variable.displayName??variable.label??'变量',result,position,visible:variable.showOnCanvas!==false,color:variable.color,icon:variable.icon,status:instance.runtimeState?.errors?.[variable.id]?'error':'valid'}});
    bySlotId[slotId].runtimeChildren.push(runtime);bySlotId[slotId].children.push(runtime);
  }
  return{bySlotId,byCoordinate:Object.fromEntries(Object.values(bySlotId).filter(entry=>entry.container.semanticCoordinate?.modularIndex!=null).map(entry=>[entry.container.semanticCoordinate.modularIndex,entry]))};
}

export function containerBadges(entry,{visibleRuntimeOnly=true}={}){
  const persistent=entry?.persistentChildren??[],runtime=(entry?.runtimeChildren??[]).filter(item=>!visibleRuntimeOnly||item.metadata?.visible!==false),items=[...persistent,...runtime],counts={knowledge:0,structure:0,content:0,variable:0,formula:0,link:0,attachment:0};for(const item of items)counts[item.type]=(counts[item.type]??0)+1;
  return{total:items.length,counts,items,persistentCount:persistent.length,runtimeCount:runtime.length};
}

export function containerItemLabel(item,state={}){
  if(item?.type==='knowledge'){
    const knowledge=(state.knowledge??[]).find(value=>value.id===item.targetId);
    return String(knowledge?.title??knowledge?.objectContent?.title??item.content?.title??'').trim()||CONTAINER_ITEM_FALLBACK_LABELS.knowledge;
  }
  if(item?.type==='structure'){
    const instance=(state.structureInstances??[]).find(value=>value.id===item.targetId),template=(state.structureTemplates??[]).find(value=>value.id===instance?.templateId);
    return String(instance?.displayTitle??instance?.objectContent?.title??instance?.title??template?.name??item.content?.title??'').trim()||CONTAINER_ITEM_FALLBACK_LABELS.structure;
  }
  const embeddedTitle=String(item?.content?.title??'').trim();if(embeddedTitle)return embeddedTitle;
  if(item?.type==='content'||item?.type==='formula'){
    const content=(state.contentObjects??[]).find(value=>value.id===item.targetId),title=content?.title??content?.objectContent?.title;
    if(String(title??'').trim())return String(title).trim();
    if(item.type==='formula'&&String(item.content?.displayFormula??'').trim())return String(item.content.displayFormula).trim();
  }
  if(item?.type==='variable'){
    const variable=(state.structureInstances??[]).flatMap(value=>value.variables??[]).find(value=>value.id===item.targetId),title=variable?.displayName??variable?.label??variable?.objectContent?.title??item.metadata?.label;
    if(String(title??'').trim())return String(title).trim();
  }
  if(item?.type==='link'){
    const link=item.content?.links?.[0],title=link?.label??link?.title??link?.url??item.content?.body;
    if(String(title??'').trim())return String(title).trim();
  }
  if(item?.type==='attachment'){
    const title=item.metadata?.fileName??item.metadata?.name??item.content?.body;
    if(String(title??'').trim())return String(title).trim();
  }
  return CONTAINER_ITEM_FALLBACK_LABELS[item?.type]??String(item?.type??'内容');
}

export function persistentContainerItems(entry){return(entry?.persistentChildren??entry?.children??[]).filter(item=>item.persistence!=='runtime')}

export function isDirectNavigableContainerItem(item,state={}){
  if(!item||!DIRECT_NAVIGABLE_CONTAINER_TYPES.includes(item.type))return false;
  if(item.type==='knowledge')return(state.knowledge??[]).some(value=>value.id===item.targetId);
  if(item.type==='structure')return(state.structureInstances??[]).some(value=>value.id===item.targetId);
  return!!item.content||(state.contentObjects??[]).some(value=>value.id===item.targetId);
}

export function resolveContainerOpenTarget(entry,state={}){
  const persistent=persistentContainerItems(entry);
  if(persistent.length===1&&isDirectNavigableContainerItem(persistent[0],state))return{kind:'item',item:persistent[0]};
  return{kind:'container',item:null,count:persistent.length};
}

export function structuralParameterImpact(instance,oldDefinition,nextDefinition){
  normalizeContainerStore(instance,oldDefinition);const oldIds=new Set(oldDefinition.slots.map(item=>item.id)),nextIds=new Set(nextDefinition.slots.map(item=>item.id)),added=[...nextIds].filter(id=>!oldIds.has(id)),removed=[...oldIds].filter(id=>!nextIds.has(id)),removedSet=new Set(removed),bindings=(instance.bindings??[]).filter(item=>removedSet.has(item.slotId)),containerItems=removed.flatMap(slotId=>instance.containers?.[slotId]?.children??[]),manualLayout=Object.keys(instance.layoutState?.nodePositions??{}).filter(id=>removedSet.has(id));
  return{nodesAdded:added,nodesRemoved:removed,bindingsAffected:bindings,containerContentAffected:containerItems,manualLayoutAffected:manualLayout,variablesRecalculated:(instance.variables??[]).map(item=>item.id)};
}

export function containerSearchText(container,children=[],state={}){
  return[container.id,container.label,container.role,container.content?.title,container.content?.summary,container.content?.body,...(container.content?.tags??[]),...children.flatMap(item=>[item.type,item.targetId,item.content?.title,item.content?.summary,item.content?.body,...(item.content?.tags??[]),containerItemLabel(item,state)])].filter(Boolean).join(' ');
}
