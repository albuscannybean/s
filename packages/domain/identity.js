const text=value=>String(value??'').trim();

export function primaryKnowledgeReference(instance,slotId){
  return(instance?.bindings??[]).find(binding=>binding.slotId===slotId&&binding.targetType==='knowledge')??null;
}

export function knowledgeForReference(state,reference){
  return reference?(state?.knowledge??[]).find(item=>item.id===reference.targetId)??null:null;
}

export function getEffectiveTitle(object,context={}){
  if(!object)return'';
  const canonical=text(object.id??context.canonicalId),fallback=text(object.canonicalDefaultLabel??object.label??object.title??object.name??canonical);
  if(context.kind==='slot'||object.semanticCoordinate||context.instance){
    const container=context.container??context.instance?.containers?.[canonical],local=text(container?.localDisplayTitle??object.localDisplayTitle??object.displayLabel);
    if(local)return local;
    const reference=context.primaryReference??primaryKnowledgeReference(context.instance,canonical),knowledge=context.knowledge??knowledgeForReference(context.state,reference);
    return text(knowledge?.title)||fallback;
  }
  return text(object.localDisplayTitle??object.title??object.name??object.label)||fallback;
}

export function effectiveSlotIdentity(slot,{instance,state,container}={}){
  const primaryReference=primaryKnowledgeReference(instance,slot.id),knowledge=knowledgeForReference(state,primaryReference);
  return{
    canonicalId:slot.id,
    semanticRole:slot.role,
    primaryReference,
    knowledge,
    followsKnowledge:!text(container?.localDisplayTitle??slot.localDisplayTitle??slot.displayLabel),
    effectiveTitle:getEffectiveTitle(slot,{kind:'slot',instance,state,container,primaryReference,knowledge})
  };
}

export function setLocalDisplayTitle(instance,slotId,value){
  instance.containers??={};instance.containers[slotId]??={id:slotId,children:[]};
  const normalized=text(value);if(normalized)instance.containers[slotId].localDisplayTitle=normalized;else delete instance.containers[slotId].localDisplayTitle;
  return normalized;
}

export function followKnowledgeTitle(instance,slotId){return setLocalDisplayTitle(instance,slotId,'')}

export const EffectiveTitleResolver=Object.freeze({resolve:getEffectiveTitle,resolveSlot:effectiveSlotIdentity,setLocal:setLocalDisplayTitle,followKnowledge:followKnowledgeTitle});
