import {ensureObjectContent} from './semantic-container.js';

export const SCHEMA_VERSION = 4;

const uid = () => globalThis.crypto?.randomUUID?.() ?? `lmn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now = () => new Date().toISOString();

export function createKnowledge(title, content = '') {
  if (!String(title).trim()) throw new Error('Knowledge title is required');
  const timestamp = now();
  const knowledge={ id: uid(), title: String(title).trim(), content, createdAt: timestamp, updatedAt: timestamp };
  ensureObjectContent(knowledge,{contentType:'note'});return knowledge;
}

export function createRelation(sourceId, targetId, type = 'related', label = '') {
  if (!sourceId || !targetId) throw new Error('Relation endpoints are required');
  const relation={ id: uid(), sourceId, targetId, type, label, createdAt: now() };
  ensureObjectContent(relation,{contentType:'custom'});return relation;
}

export function createRepresentation(knowledgeId, kind, data = {}) {
  if (!knowledgeId || !['text', 'freeform', 'lmn', 'structure'].includes(kind)) throw new Error('Invalid representation');
  return { id: uid(), knowledgeId, kind, data, createdAt: now(), updatedAt: now() };
}

export function neighborhood(knowledge, relations, rootId, depth = 2) {
  const byId = new Map(knowledge.map(k => [k.id, k]));
  const visited = new Set([rootId]);
  let frontier = [rootId];
  for (let level = 0; level < Math.max(0, depth); level++) {
    const next = [];
    for (const id of frontier) for (const r of relations) {
      const other = r.sourceId === id ? r.targetId : r.targetId === id ? r.sourceId : null;
      if (other && !visited.has(other)) { visited.add(other); next.push(other); }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { nodes: [...visited].map(id => byId.get(id)).filter(Boolean), edges: relations.filter(r => visited.has(r.sourceId) && visited.has(r.targetId)) };
}

export function filterRelations(relations,criteria={}){
  const types=criteria.types?.length?new Set(criteria.types):null,labels=criteria.labels?.length?new Set(criteria.labels):null;
  return(relations??[]).filter(relation=>(!types||types.has(relation.type))&&(!labels||labels.has(relation.label))&&(!criteria.sourceId||relation.sourceId===criteria.sourceId)&&(!criteria.targetId||relation.targetId===criteria.targetId));
}

export function directedTraversal(relations,rootId,{direction='outgoing',depth=2,types=null}={}){
  const edges=filterRelations(relations,{types}),visited=new Set([rootId]),edgeIds=new Set(),distanceById={[rootId]:0};let frontier=[rootId];
  for(let level=0;level<Math.max(0,depth);level++){const next=[];for(const id of frontier)for(const relation of edges){const targets=[];if(direction!=='incoming'&&relation.sourceId===id)targets.push(relation.targetId);if(direction!=='outgoing'&&relation.targetId===id)targets.push(relation.sourceId);for(const target of targets)if(target){edgeIds.add(relation.id);if(!visited.has(target)){visited.add(target);distanceById[target]=level+1;next.push(target)}}}frontier=next;if(!frontier.length)break}
  return{nodeIds:[...visited],edgeIds:[...edgeIds],distanceById};
}

export function semanticNeighborhood(knowledge,relations,rootId,depth=2,criteria={}){
  const traversal=directedTraversal(filterRelations(relations,criteria),rootId,{direction:'both',depth}),ids=new Set(traversal.nodeIds);return{nodes:(knowledge??[]).filter(item=>ids.has(item.id)),edges:(relations??[]).filter(item=>traversal.edgeIds.includes(item.id)),distanceById:traversal.distanceById};
}

export function dependencyClosure(relations,rootIds,{direction='outgoing',types=['depends-on','dependency','requires'],depth=Number.MAX_SAFE_INTEGER}={}){
  const nodeIds=new Set(),edgeIds=new Set();for(const rootId of(Array.isArray(rootIds)?rootIds:[rootIds])){const result=directedTraversal(relations,rootId,{direction,types,depth});result.nodeIds.forEach(id=>nodeIds.add(id));result.edgeIds.forEach(id=>edgeIds.add(id))}return{nodeIds:[...nodeIds],edgeIds:[...edgeIds]};
}

export function shortestMeaningfulPath(relations,sourceId,targetId,{direction='both',types=null}={}){
  const edges=filterRelations(relations,{types}),queue=[[sourceId]],seen=new Set([sourceId]);while(queue.length){const path=queue.shift(),current=path.at(-1);if(current===targetId){const edgePath=[];for(let index=1;index<path.length;index++)edgePath.push(edges.find(edge=>(edge.sourceId===path[index-1]&&edge.targetId===path[index])||(direction==='both'&&edge.targetId===path[index-1]&&edge.sourceId===path[index]))?.id);return{nodeIds:path,edgeIds:edgePath.filter(Boolean)}}for(const edge of edges){let next=null;if(direction!=='incoming'&&edge.sourceId===current)next=edge.targetId;if(direction!=='outgoing'&&edge.targetId===current)next=edge.sourceId;if(next&&!seen.has(next)){seen.add(next);queue.push([...path,next])}}}return null;
}

export function connectedComponents(knowledge, relations) {
  const unseen = new Set(knowledge.map(k => k.id));
  const result = [];
  while (unseen.size) {
    const start = unseen.values().next().value;
    const component = neighborhood(knowledge, relations, start, knowledge.length + 1).nodes.map(n => n.id);
    component.forEach(id => unseen.delete(id));
    result.push(component);
  }
  return result;
}

export function detectCycle(nodeIds, edges) {
  const graph = new Map(nodeIds.map(id => [id, []]));
  edges.forEach(e => graph.get(e.sourceId)?.push(e.targetId));
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of graph.get(id) ?? []) if (visit(child)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return nodeIds.some(visit);
}

export function transitiveReduction(nodeIds, edges) {
  if (detectCycle(nodeIds, edges)) return { edges, warning: '偏序必须无环；当前关系未做约简' };
  const reduced = edges.filter((edge, index) => {
    const others = edges.filter((_, i) => i !== index);
    const seen = new Set([edge.sourceId]), queue = [edge.sourceId];
    while (queue.length) {
      const current = queue.shift();
      for (const candidate of others.filter(e => e.sourceId === current)) {
        if (candidate.targetId === edge.targetId) return false;
        if (!seen.has(candidate.targetId)) { seen.add(candidate.targetId); queue.push(candidate.targetId); }
      }
    }
    return true;
  });
  return { edges: reduced, warning: null };
}

export function deletionImpact(state, knowledgeId) {
  return {
    relations: (state.relations ?? []).filter(r => r.sourceId === knowledgeId || r.targetId === knowledgeId),
    representations: (state.representations ?? []).filter(r => r.knowledgeId === knowledgeId),
    structureReferences: (state.structureInstances ?? []).flatMap(instance => (instance.bindings ?? []).filter(binding => binding.targetType === 'knowledge' && binding.targetId === knowledgeId).map(binding => ({ instanceId: instance.id, bindingId: binding.id, slotId: binding.slotId }))),
    ownedStructures: (state.structureInstances ?? []).filter(instance => instance.ownerKnowledgeId === knowledgeId)
  };
}
