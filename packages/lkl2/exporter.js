import {normalizeStructureView,structureViewSemanticSnapshot} from '../structure-engine/structure-view.js';
import {BUNDLE_FORMAT_VERSION} from '../app-metadata.js';

const clone=value=>structuredClone(value);
const local=(external,fallback)=>String(external??'').split('/').at(-1)?.replace(/^[^:]+:/,'')||fallback;
const isPersistentContent=item=>item?.persistence!=='runtime'&&['content','formula'].includes(item?.type);

export function exportStateKnowledgePackage(state,{rootKnowledgeId,packageId='pkg:local-export',title=null}={}){
  const root=state.knowledge.find(item=>item.id===rootKnowledgeId)??state.knowledge[0];
  if(!root)throw new Error('A root Knowledge is required');
  const packageRecord=(state.knowledgePackages??[]).find(item=>item.rootKnowledgeId===root.id||item.rootInternalId===root.id||item.stableId===packageId);
  const knowledge=[],instances=[],contents=[],relations=[],views=[],boards=[];
  const knowledgeSeen=new Set(),instanceSeen=new Set(),contentSeen=new Set(),boardSeen=new Set(),queue=[{type:'knowledge',id:root.id}];

  while(queue.length){
    const current=queue.shift();
    if(current.type==='knowledge'){
      if(knowledgeSeen.has(current.id))continue;knowledgeSeen.add(current.id);
      const item=state.knowledge.find(value=>value.id===current.id);if(!item)continue;knowledge.push(item);
      for(const instance of state.structureInstances.filter(value=>value.ownerKnowledgeId===item.id))queue.push({type:'structure',id:instance.id});
      for(const board of (state.boards??[]).filter(value=>value.ownerKnowledgeId===item.id))queue.push({type:'board',id:board.id});
      for(const relation of state.relations.filter(value=>value.sourceId===item.id||value.targetId===item.id)){relations.push(relation);queue.push({type:'knowledge',id:relation.sourceId===item.id?relation.targetId:relation.sourceId})}
      continue;
    }
    if(current.type==='board'){
      if(boardSeen.has(current.id))continue;boardSeen.add(current.id);
      const board=(state.boards??[]).find(value=>value.id===current.id);if(!board)continue;boards.push(board);
      for(const frame of board.frames??[])queue.push({type:'structure',id:frame.instanceId});
      continue;
    }
    if(instanceSeen.has(current.id))continue;instanceSeen.add(current.id);
    const instance=state.structureInstances.find(value=>value.id===current.id);if(!instance)continue;instances.push(instance);
    for(const container of Object.values(instance.containers??{}))for(const child of container.children??[]){if(child.persistence==='runtime')continue;if(child.type==='knowledge')queue.push({type:'knowledge',id:child.targetId});if(child.type==='structure')queue.push({type:'structure',id:child.targetId});if(isPersistentContent(child))collectContent(child)}
    const view=state.structureViews?.find(value=>value.instanceId===instance.id);views.push(view??{id:`view:${instance.id}`,instanceId:instance.id,...structureViewSemanticSnapshot(instance)});
  }

  function collectContent(child){const referenced=child.targetId?state.contentObjects?.find(value=>value.id===child.targetId):null,record=referenced??{id:child.id,type:child.type,title:child.content?.title,summary:child.content?.summary,body:child.content?.body,latex:child.content?.displayFormula,tags:child.content?.tags,sources:child.content?.sources,objectContent:child.content,externalStableId:child.metadata?.externalStableId};if(!record?.id||contentSeen.has(record.id))return;contentSeen.add(record.id);contents.push(record)}

  const knowledgeStable=new Map(knowledge.map(item=>[item.id,local(item.externalStableId,item.id)])),instanceStable=new Map(instances.map(item=>[item.id,local(item.externalStableId,item.id)])),contentStable=new Map(contents.map(item=>[item.id,local(item.externalStableId,item.id)])),boardStable=new Map(boards.map(item=>[item.id,local(item.externalStableId,item.stableId??item.id)]));
  const usedTemplateIds=new Set(instances.map(item=>item.templateId).filter(id=>id&&!String(id).startsWith('builtin:'))),templates=(state.structureTemplates??[]).filter(item=>usedTemplateIds.has(item.id)),templateStable=new Map(templates.map(item=>[item.id,local(item.externalStableId,item.id)])),contentRef=child=>contentStable.get(child.targetId)??contentStable.get(child.id);
  const typedStable=(type,id)=>{const normalized=type==='structure-instance'?'structure':type,map=normalized==='knowledge'?knowledgeStable:normalized==='structure'?instanceStable:normalized==='content'?contentStable:normalized==='board'?boardStable:null,stable=map?.get(id);return stable?{type:normalized,id:stable}:null};
  const placements=[],placementKeys=new Set(),pushPlacement=item=>{if(!item.target||!item.parent)return;const key=`${item.target.type}:${item.target.id}|${item.parent.type}:${item.parent.id}|${item.path??''}|${item.mode}`;if(placementKeys.has(key))return;placementKeys.add(key);placements.push(item)};
  for(const item of state.placements??[]){const target=typedStable(item.targetType,item.targetId),parent=typedStable(item.parentType,item.parentId);pushPlacement({stableId:local(item.externalStableId,item.stableId??item.id),target,parent,mode:item.mode==='reference'?'reference':'construct',order:Number(item.order??0),path:item.path??''})}
  const explicitlyPlacedTargets=new Set((state.placements??[]).filter(item=>item.mode!=='reference').map(item=>`${item.targetType}:${item.targetId}`));
  for(const instance of instances){const instanceRef={type:'structure',id:instanceStable.get(instance.id)};if(knowledgeStable.has(instance.ownerKnowledgeId)&&!explicitlyPlacedTargets.has(`structure:${instance.id}`))pushPlacement({stableId:`owner-${instanceStable.get(instance.id)}`,target:instanceRef,parent:{type:'knowledge',id:knowledgeStable.get(instance.ownerKnowledgeId)},mode:'construct',order:0,path:''});for(const binding of instance.bindings??[]){const target=typedStable(binding.targetType,binding.targetId);pushPlacement({stableId:local(binding.externalStableId,binding.id),target,parent:instanceRef,mode:binding.metadata?.placementMode==='reference'?'reference':'construct',order:Number(binding.metadata?.order??0),path:binding.slotId})}}
  const defaultBoard=boards.find(item=>item.id===packageRecord?.defaultBoardId)??boards[0],defaultEntry=defaultBoard?'board-root':'root';

  return{
    lklVersion:2,
    package:{stableId:packageRecord?.stableId??packageId,title:title??packageRecord?.title??root.title,description:packageRecord?.description??`从 ${root.title} 导出的知识包`,version:packageRecord?.version??'1.0',migrationVersion:packageRecord?.migrationVersion??BUNDLE_FORMAT_VERSION,language:packageRecord?.language??'zh-CN',authors:clone(packageRecord?.authors??[]),tags:clone(packageRecord?.tags??[]),suggestedTheme:packageRecord?.suggestedTheme??'',root:{type:'knowledge',id:knowledgeStable.get(root.id)},defaultEntry},
    knowledge:knowledge.map(item=>({stableId:knowledgeStable.get(item.id),title:item.title,nameI18n:clone(item.nameI18n??{'zh-CN':item.title,en:item.title}),aliases:clone(item.aliases??[]),summary:item.summary??item.objectContent?.summary??'',body:item.content??item.objectContent?.body??'',bodyFormat:'markdown',tags:clone(item.tags??item.objectContent?.tags??[]),sources:clone(item.sources??item.objectContent?.sources??[])})),
    contents:contents.map(item=>({stableId:contentStable.get(item.id),type:item.type??item.objectContent?.contentType??'note',title:item.title??item.objectContent?.title??'',summary:item.summary??item.objectContent?.summary??'',body:item.body??item.objectContent?.body??'',bodyFormat:'markdown',latex:item.latex??item.objectContent?.displayFormula??'',tags:clone(item.tags??item.objectContent?.tags??[]),sources:clone(item.sources??item.objectContent?.sources??[])})),
    structureTemplates:templates.map(item=>({stableId:templateStable.get(item.id),name:item.name,nameI18n:clone(item.nameI18n),description:item.description,descriptionI18n:clone(item.descriptionI18n),layout:clone(item.layout),slots:clone(item.slots??[]),edges:clone(item.edges??[])})),
    structureInstances:instances.map(instance=>({stableId:instanceStable.get(instance.id),templateRef:String(instance.templateId).startsWith('builtin:')?instance.templateId:templateStable.get(instance.templateId),ownerRef:knowledgeStable.get(instance.ownerKnowledgeId)??'',title:instance.objectContent?.title??'',parameters:clone(instance.parameters??{}),runtime:{runtimeState:clone(instance.runtimeState??{}),plotExpressions:clone(instance.plotExpressions??[]),motionPoints:clone(instance.motionPoints??[]),objectVisibility:clone(instance.objectVisibility??{}),designStyles:clone(instance.designStyles??{}),relationStyles:clone(instance.relationStyles??{})},geometries:clone(instance.geometryPrimitives??[]),variables:(instance.variables??[]).map(variable=>({stableId:variable.id,label:variable.label,displayName:variable.displayName??variable.label,nameI18n:clone(variable.nameI18n??{'zh-CN':variable.displayName??variable.label,en:variable.displayName??variable.label}),group:variable.group??'未分组',order:Number(variable.order??0),kind:variable.kind,type:variable.type,value:variable.value,expression:variable.formula,displayFormula:variable.displayFormula,showOnCanvas:variable.showOnCanvas})),containers:Object.entries(instance.containers??{}).map(([slotId,container])=>({slotId,title:container.content?.title??container.label??'',localDisplayTitle:container.localDisplayTitle??'',knowledgeRefs:(container.children??[]).filter(item=>item.persistence!=='runtime'&&item.type==='knowledge').map(item=>knowledgeStable.get(item.targetId)).filter(Boolean),contentRefs:(container.children??[]).filter(isPersistentContent).map(contentRef).filter(Boolean),structureRefs:(container.children??[]).filter(item=>item.persistence!=='runtime'&&item.type==='structure').map(item=>instanceStable.get(item.targetId)).filter(Boolean),variableRefs:(container.children??[]).filter(item=>item.persistence!=='runtime'&&item.type==='variable').map(item=>item.targetId).filter(Boolean)}))})),
    relations:[...new Map(relations.map(item=>[item.id,item])).values()].filter(item=>knowledgeStable.has(item.sourceId)&&knowledgeStable.has(item.targetId)).map(item=>({stableId:local(item.externalStableId,item.id),from:{type:'knowledge',id:knowledgeStable.get(item.sourceId)},to:{type:'knowledge',id:knowledgeStable.get(item.targetId)},type:item.type,label:item.label,body:item.body??item.objectContent?.body??'',bodyFormat:'markdown'})),
    variables:[],
    views:views.map(view=>{const snapshot=normalizeStructureView(view);return{stableId:local(view.externalStableId,view.id),forRef:instanceStable.get(view.instanceId),...structureViewSemanticSnapshot({structureView:snapshot}),objectVisibility:clone(view.objectVisibility??{})}}),
    boards:boards.map(board=>({stableId:boardStable.get(board.id),title:board.title,description:board.description??'',ownerRef:knowledgeStable.get(board.ownerKnowledgeId),width:Number(board.width??1600),height:Number(board.height??1000),frames:(board.frames??[]).filter(frame=>instanceStable.has(frame.instanceId)).map((frame,index)=>({stableId:local(frame.externalStableId,frame.stableId??frame.id),instanceRef:instanceStable.get(frame.instanceId),x:Number(frame.x??0),y:Number(frame.y??0),width:Number(frame.width??520),height:Number(frame.height??360),zIndex:Number(frame.zIndex??index+1),order:Number(frame.order??index),previewPolicy:frame.previewPolicy??'detailed'}))})),
    placements,
    entries:[{stableId:'root',title:'开始阅读',target:{type:'knowledge',id:knowledgeStable.get(root.id)}},...(defaultBoard?[{stableId:'board-root',title:defaultBoard.title,target:{type:'board',id:boardStable.get(defaultBoard.id)}}]:[])],
    sources:clone(state.sources??[])
  };
}
