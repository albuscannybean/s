const clone=value=>structuredClone(value);

export function knowledgeDeletionImpact(state,knowledgeId){
  const ownedStructures=(state.structureInstances??[]).filter(item=>item.ownerKnowledgeId===knowledgeId),ownedIds=new Set(ownedStructures.map(item=>item.id));
  const externalBindings=(state.structureInstances??[]).flatMap(instance=>(instance.bindings??[]).filter(binding=>binding.targetType==='knowledge'&&binding.targetId===knowledgeId).map(binding=>({instanceId:instance.id,bindingId:binding.id,slotId:binding.slotId})));
  const nestedReferences=(state.structureInstances??[]).flatMap(instance=>(instance.bindings??[]).filter(binding=>binding.targetType==='structure'&&ownedIds.has(binding.targetId)).map(binding=>({instanceId:instance.id,bindingId:binding.id,targetId:binding.targetId})));
  const relations=(state.relations??[]).filter(item=>item.sourceId===knowledgeId||item.targetId===knowledgeId);
  return{knowledgeId,ownedStructures,externalBindings,nestedReferences,relations,representations:(state.representations??[]).filter(item=>item.knowledgeId===knowledgeId)};
}

export function deleteKnowledgeObject(state,knowledgeId){
  const impact=knowledgeDeletionImpact(state,knowledgeId),ownedIds=new Set(impact.ownedStructures.map(item=>item.id));
  state.knowledge=state.knowledge.filter(item=>item.id!==knowledgeId);
  state.relations=state.relations.filter(item=>item.sourceId!==knowledgeId&&item.targetId!==knowledgeId);
  state.representations=state.representations.filter(item=>item.knowledgeId!==knowledgeId&&!ownedIds.has(item.data?.instanceId));
  state.structureInstances=state.structureInstances.filter(item=>!ownedIds.has(item.id));
  for(const instance of state.structureInstances)instance.bindings=(instance.bindings??[]).filter(binding=>!(binding.targetType==='knowledge'&&binding.targetId===knowledgeId)&&!(binding.targetType==='structure'&&ownedIds.has(binding.targetId)));
  return impact;
}

export function structureDeletionImpact(state,instanceId){
  const instance=(state.structureInstances??[]).find(item=>item.id===instanceId),references=(state.structureInstances??[]).flatMap(owner=>(owner.bindings??[]).filter(binding=>binding.targetType==='structure'&&binding.targetId===instanceId).map(binding=>({instanceId:owner.id,bindingId:binding.id,slotId:binding.slotId}))),ownedBindings=instance?.bindings??[];
  return{instance,references,bindingImpact:references.length+ownedBindings.length,nestedPathsAffected:references.length};
}

export function deleteStructureObject(state,instanceId){
  const impact=structureDeletionImpact(state,instanceId);
  state.structureInstances=state.structureInstances.filter(item=>item.id!==instanceId);
  state.representations=state.representations.filter(item=>item.data?.instanceId!==instanceId&&item.settings?.instanceId!==instanceId&&item.instanceId!==instanceId);
  for(const instance of state.structureInstances)instance.bindings=(instance.bindings??[]).filter(binding=>!(binding.targetType==='structure'&&binding.targetId===instanceId));
  return impact;
}

export function userTemplateDeletionImpact(state,templateId){
  const template=(state.structureTemplates??[]).find(item=>item.id===templateId),instances=(state.structureInstances??[]).filter(item=>item.templateId===templateId),ids=new Set(instances.map(item=>item.id)),references=(state.structureInstances??[]).flatMap(owner=>(owner.bindings??[]).filter(binding=>binding.targetType==='structure'&&ids.has(binding.targetId)).map(binding=>({instanceId:owner.id,bindingId:binding.id,targetId:binding.targetId})));
  return{template,instances,references};
}

export function deleteUserTemplateObject(state,templateId){
  const impact=userTemplateDeletionImpact(state,templateId);if(!impact.template||impact.template.builtin)throw new Error('Built-in templates cannot be deleted');
  const ids=new Set(impact.instances.map(item=>item.id));state.structureTemplates=state.structureTemplates.filter(item=>item.id!==templateId);state.structureInstances=state.structureInstances.filter(item=>!ids.has(item.id));state.representations=state.representations.filter(item=>!ids.has(item.data?.instanceId));for(const instance of state.structureInstances)instance.bindings=(instance.bindings??[]).filter(binding=>!(binding.targetType==='structure'&&ids.has(binding.targetId)));return impact;
}

export function duplicateKnowledgeObject(state,knowledgeId){
  const source=state.knowledge.find(item=>item.id===knowledgeId);if(!source)throw new Error('Knowledge not found');const stamp=Date.now(),copy={...clone(source),id:crypto.randomUUID(),title:`${source.title} 副本`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},map=new Map();state.knowledge.push(copy);for(const sourceInstance of state.structureInstances.filter(item=>item.ownerKnowledgeId===knowledgeId)){const instance={...clone(sourceInstance),id:crypto.randomUUID(),ownerKnowledgeId:copy.id,bindings:clone(sourceInstance.bindings??[]).map(binding=>({...binding,id:crypto.randomUUID(),instanceId:null})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};instance.bindings.forEach(binding=>binding.instanceId=instance.id);map.set(sourceInstance.id,instance.id);state.structureInstances.push(instance);state.representations.push({id:`representation:${stamp}:${instance.id}`,knowledgeId:copy.id,kind:'structure',data:{instanceId:instance.id},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})}for(const instance of state.structureInstances.filter(item=>item.ownerKnowledgeId===copy.id))for(const binding of instance.bindings)if(binding.targetType==='structure'&&map.has(binding.targetId))binding.targetId=map.get(binding.targetId);return copy;
}
