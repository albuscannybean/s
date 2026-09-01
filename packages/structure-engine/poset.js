const slot=(id,label,rank=null,order=0)=>({id,label,role:'poset-element',semanticCoordinate:{preferredRank:rank,rank:rank??0,order},accepts:['knowledge','structure','value','variable'],cardinality:'many'});
const edge=(id,lower,upper)=>({id,sourceSlotId:lower,targetSlotId:upper,direction:'directed',relationType:'covers',label:'≺',routing:'straight'});

export function createPosetStarter(starter='blank',relationText=''){
  if(starter==='diamond')return{slots:[slot('bottom','⊥',0,0),slot('a','a',1,0),slot('b','b',1,1),slot('top','⊤',2,0)],edges:[edge('cover-bottom-a','bottom','a'),edge('cover-bottom-b','bottom','b'),edge('cover-a-top','a','top'),edge('cover-b-top','b','top')]};
  if(starter==='subset')return{slots:[slot('empty','∅',0,0),slot('a','{a}',1,0),slot('b','{b}',1,1),slot('ab','{a,b}',2,0)],edges:[edge('subset-empty-a','empty','a'),edge('subset-empty-b','empty','b'),edge('subset-a-ab','a','ab'),edge('subset-b-ab','b','ab')]};
  if(starter==='divisibility')return{slots:[slot('one','1',0,0),slot('two','2',1,0),slot('three','3',1,1),slot('six','6',2,0)],edges:[edge('divides-1-2','one','two'),edge('divides-1-3','one','three'),edge('divides-2-6','two','six'),edge('divides-3-6','three','six')]};
  if(starter==='numeric')return{slots:[slot('n0','0',0,0),slot('n1','1',1,0),slot('n2','2',2,0),slot('n3','3',3,0)],edges:[edge('le-0-1','n0','n1'),edge('le-1-2','n1','n2'),edge('le-2-3','n2','n3')]};
  if(starter==='relation-text')return parseRelationText(relationText);
  return{slots:[],edges:[]};
}

export function serializePosetRelationText(slots=[],edges=[]){
  const labels=new Map(slots.map(item=>[item.id,String(item.displayLabel??item.label??item.id)]));
  return edges.filter(item=>labels.has(item.sourceSlotId)&&labels.has(item.targetSlotId)).map(item=>`${labels.get(item.sourceSlotId)} < ${labels.get(item.targetSlotId)}`).join('\n');
}

export function posetStarterRelationText(starter='blank'){
  const generated=createPosetStarter(starter,'');return serializePosetRelationText(generated.slots,generated.edges);
}

export function parseRelationText(source=''){
  const chains=String(source).split(/\r?\n|;|,/).map(line=>line.trim()).filter(Boolean).map(line=>line.split(/\s*(?:≺|<|≤|->)\s*/).map(value=>value.trim()).filter(Boolean)).filter(chain=>chain.length>=2),pairs=chains.flatMap(chain=>chain.slice(0,-1).map((lower,index)=>[lower,chain[index+1]])),labels=[...new Set(pairs.flat())],ids=new Map(labels.map((label,index)=>[label,`element-${index+1}`])),rawEdges=pairs.map(([lower,upper],index)=>edge(`cover-${index+1}`,ids.get(lower),ids.get(upper))),definition={slots:labels.map((label,index)=>slot(ids.get(label),label,null,index)),edges:rawEdges},analysis=analyzePoset(definition.slots,definition.edges);
  return{slots:definition.slots.map(value=>({...value,semanticCoordinate:{...value.semanticCoordinate,rank:analysis.ranks[value.id]??0}})),edges:analysis.reduction};
}

export function analyzePoset(slots=[],edges=[]){
  const ids=new Set(slots.map(item=>item.id)),relations=edges.filter(item=>ids.has(item.sourceSlotId)&&ids.has(item.targetSlotId)&&item.sourceSlotId!==item.targetSlotId),adjacency=new Map([...ids].map(id=>[id,new Set()]));for(const relation of relations)adjacency.get(relation.sourceSlotId).add(relation.targetSlotId);
  const cycle=findCycle(adjacency),valid=!cycle,closure=computeClosure(adjacency),reduction=valid?transitiveReduction(relations,adjacency):relations.map(item=>({...item})),incoming=new Map([...ids].map(id=>[id,0]));for(const [source,targets] of adjacency)for(const target of targets)incoming.set(target,(incoming.get(target)??0)+1);
  const minimal=[...ids].filter(id=>incoming.get(id)===0),maximal=[...ids].filter(id=>adjacency.get(id).size===0),least=[...ids].find(id=>[...ids].every(other=>other===id||closure.get(id).has(other)))??null,greatest=[...ids].find(id=>[...ids].every(other=>other===id||closure.get(other).has(id)))??null,ranks=automaticRanks(ids,adjacency,incoming),pairs={};let lattice=valid;
  for(const left of ids)for(const right of ids){const key=`${left}|${right}`,bounds=pairBounds(left,right,ids,closure);pairs[key]=bounds;if(bounds.suprema.length!==1||bounds.infima.length!==1)lattice=false}
  return{valid,errors:cycle?[`存在有向环：${cycle.join(' → ')}`]:[],cycle,closure,reduction,minimal,maximal,least,greatest,ranks,lattice,pairs,relationCount:relations.length,coverCount:reduction.length};
}

export function validatePoset(slots,edges){const analysis=analyzePoset(slots,edges);return{valid:analysis.valid,errors:analysis.errors,analysis}}

export function pairBounds(left,right,idsOrAnalysis,closureMaybe){
  const ids=idsOrAnalysis instanceof Set?idsOrAnalysis:new Set(idsOrAnalysis?.closure?.keys?.()??[]),closure=closureMaybe??idsOrAnalysis.closure;
  const le=(a,b)=>a===b||closure.get(a)?.has(b),upper=[...ids].filter(candidate=>le(left,candidate)&&le(right,candidate)),lower=[...ids].filter(candidate=>le(candidate,left)&&le(candidate,right));
  const suprema=upper.filter(candidate=>!upper.some(other=>other!==candidate&&le(other,candidate))),infima=lower.filter(candidate=>!lower.some(other=>other!==candidate&&le(candidate,other)));
  return{upper,lower,suprema,infima,sup:suprema.length===1?suprema[0]:null,inf:infima.length===1?infima[0]:null};
}

export function transitiveReduction(edges,adjacency=null){
  const graph=adjacency??toAdjacency(edges),result=[];
  for(const relation of edges){graph.get(relation.sourceSlotId)?.delete(relation.targetSlotId);const redundant=reachable(graph,relation.sourceSlotId,relation.targetSlotId);graph.get(relation.sourceSlotId)?.add(relation.targetSlotId);if(!redundant)result.push({...relation,relationType:'covers',label:relation.label||'≺'})}
  return result;
}

function toAdjacency(edges){const ids=new Set(edges.flatMap(item=>[item.sourceSlotId,item.targetSlotId])),map=new Map([...ids].map(id=>[id,new Set()]));for(const edgeValue of edges)map.get(edgeValue.sourceSlotId).add(edgeValue.targetSlotId);return map}
function computeClosure(adjacency){const closure=new Map();for(const id of adjacency.keys()){const reached=new Set(),queue=[...(adjacency.get(id)??[])];while(queue.length){const next=queue.shift();if(reached.has(next))continue;reached.add(next);queue.push(...(adjacency.get(next)??[]))}closure.set(id,reached)}return closure}
function reachable(adjacency,source,target){const seen=new Set(),queue=[...(adjacency.get(source)??[])];while(queue.length){const value=queue.shift();if(value===target)return true;if(seen.has(value))continue;seen.add(value);queue.push(...(adjacency.get(value)??[]))}return false}
function findCycle(adjacency){const visiting=new Set(),visited=new Set(),path=[];function visit(id){if(visiting.has(id)){const index=path.indexOf(id);return[...path.slice(index),id]}if(visited.has(id))return null;visiting.add(id);path.push(id);for(const target of adjacency.get(id)??[]){const cycle=visit(target);if(cycle)return cycle}path.pop();visiting.delete(id);visited.add(id);return null}for(const id of adjacency.keys()){const cycle=visit(id);if(cycle)return cycle}return null}
function automaticRanks(ids,adjacency,incoming){const ranks={},queue=[...ids].filter(id=>incoming.get(id)===0);for(const id of queue)ranks[id]=0;while(queue.length){const id=queue.shift();for(const target of adjacency.get(id)??[]){ranks[target]=Math.max(ranks[target]??0,(ranks[id]??0)+1);queue.push(target)}}return ranks}
