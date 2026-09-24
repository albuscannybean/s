// Match the arrows actually rendered, including instance-level visual overrides.
export function mapArrowEnds(edge){
  const arrow=edge.visual?.arrow??'direction';
  return {end:arrow==='forward'||arrow==='both'||(arrow==='direction'&&edge.direction!=='undirected'),start:arrow==='reverse'||arrow==='both'||(arrow==='direction'&&edge.direction==='bidirectional')};
}
export function nextMapNodes(definition,currentId){
  const valid=new Set(definition.slots.map(slot=>slot.id)),next=new Map();
  for(const edge of definition.edges??[]){
    const {start,end}=mapArrowEnds(edge);
    const targets=[];
    if(end&&edge.sourceSlotId===currentId)targets.push(edge.targetSlotId);
    if(start&&edge.targetSlotId===currentId)targets.push(edge.sourceSlotId);
    for(const id of targets)if(valid.has(id)){
      if(!next.has(id))next.set(id,{id,edges:[]});
      next.get(id).edges.push(edge);
    }
  }
  return [...next.values()];
}
