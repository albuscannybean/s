/** Presentation only: collapse directly owned structure/body rows into their Knowledge. */
export function unifiedOutline(index){
 const objects=new Map(index.objects),children=new Map([...index.children].map(([key,links])=>[key,[...links]])),parents=new Map(index.parents),aliases=new Map();
 for(const knowledge of objects.values()){
  if(knowledge.kind!=='knowledge')continue;
  const links=index.children.get(knowledge.key)??[],owned=links.filter(link=>link.canonical&&objects.get(link.child)?.kind==='structure'&&objects.get(link.child).record.ownerKnowledgeId===knowledge.id);
  if(!owned.length)continue;
  const structured=[];
  for(const link of links){
   const child=objects.get(link.child);
   if(child.kind==='note'&&child.contentScope==='knowledge'){aliases.set(child.key,knowledge.key);continue}
   if(!owned.includes(link)){structured.push(link);continue}
   aliases.set(child.key,knowledge.key);
   for(const inner of index.children.get(child.key)??[]){
    const entry=objects.get(inner.child);
    if(entry.kind==='note'&&entry.contentScope==='structure'){aliases.set(entry.key,knowledge.key);continue}
    structured.push({...inner,parent:knowledge.key});if(inner.canonical)parents.set(inner.child,knowledge.key);
    if(owned.length>1)objects.set(entry.key,{...entry,label:child.label+' · '+entry.label});
   }
  }
  children.set(knowledge.key,structured);
 }
 return {...index,objects,children,parents,outlineKey:key=>aliases.get(key)??key};
}
