import {materializeInstanceDefinition} from '../structure-engine/model.js';

const uid=()=>globalThis.crypto?.randomUUID?.()??`query-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().trim();
const wildcard=value=>new RegExp(`^${String(value??'*').replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('*','.*').replaceAll('?','.')}$`,'i');
const textMatches=(pattern,value)=>!pattern||pattern==='*'||wildcard(pattern).test(String(value??''))||normalize(value).includes(normalize(pattern).replaceAll('*',''));

export function createStructureQuery(template,definition,{mode='contains',parameters={}}={}){
  return{id:uid(),version:1,mode,templateId:template?.id??null,parameters:structuredClone(parameters),nodes:(definition?.slots??template?.slots??[]).map(slot=>({id:slot.id,role:slot.role??'*',text:'*',title:'*',content:'*',variable:'*',nested:null})),edges:(definition?.edges??template?.edges??[]).map(edge=>({id:edge.id,from:edge.sourceSlotId,to:edge.targetSlotId,direction:edge.direction??'*',relationType:edge.relationType??'*',label:'*'})),paths:[],createdAt:new Date().toISOString()};
}

const slotHaystack=(slot,instance,state)=>{const container=instance.containers?.[slot.id],children=container?.children??[],content=children.map(item=>`${item.content?.title??''} ${item.content?.body??''}`).join(' '),variables=(instance.variables??[]).map(item=>`${item.id} ${item.label} ${item.displayName??''} ${item.formula??''}`).join(' ');return{title:`${slot.displayLabel??slot.label??''}`,content,variable:variables,all:`${slot.id} ${slot.role??''} ${slot.displayLabel??slot.label??''} ${content} ${variables}`}};

function nodeCandidates(queryNode,definition,instance,state){return definition.slots.filter(slot=>{const haystack=slotHaystack(slot,instance,state);return textMatches(queryNode.role,slot.role)&&textMatches(queryNode.title,haystack.title)&&textMatches(queryNode.text,haystack.all)&&textMatches(queryNode.content,haystack.content)&&textMatches(queryNode.variable,haystack.variable)})}

function edgeMatches(queryEdge,edge,map){return map.get(queryEdge.from)===edge.sourceSlotId&&map.get(queryEdge.to)===edge.targetSlotId&&textMatches(queryEdge.direction,edge.direction)&&textMatches(queryEdge.relationType,edge.relationType)&&textMatches(queryEdge.label,edge.displayLabel??edge.label)}

function nestedMatches(queryNode,slotId,instance,state,templates,visited){if(!queryNode.nested)return true;const targets=(instance.bindings??[]).filter(binding=>binding.slotId===slotId&&binding.targetType==='structure').map(binding=>binding.targetId);return targets.some(id=>matchStructureQuery(queryNode.nested,state.structureInstances.find(item=>item.id===id),state,{templates,visited}).matched)}

export function matchStructureQuery(query,instance,state,{templates=state.structureTemplates??[],visited=new Set()}={}){
  if(!query||!instance||visited.has(instance.id))return{matched:false,nodeIds:[],edgeIds:[],reason:'循环或对象不存在'};const template=templates.find(item=>item.id===instance.templateId);if(!template||query.templateId&&query.templateId!==template.id)return{matched:false,nodeIds:[],edgeIds:[],reason:'模板不匹配'};const definition=materializeInstanceDefinition(template,instance),queryNodes=query.nodes??[],queryEdges=query.edges??[];
  if(query.mode==='exact'&&(queryNodes.length!==definition.slots.length||queryEdges.length!==definition.edges.length))return{matched:false,nodeIds:[],edgeIds:[],reason:'规模不完全相同'};
  const candidates=new Map(queryNodes.map(node=>[node.id,nodeCandidates(node,definition,instance,state)])),ordered=[...queryNodes].sort((a,b)=>candidates.get(a.id).length-candidates.get(b.id).length),map=new Map(),used=new Set(),nextVisited=new Set(visited).add(instance.id);
  const search=index=>{if(index>=ordered.length)return queryEdges.every(edge=>definition.edges.some(candidate=>edgeMatches(edge,candidate,map)))&&ordered.every(node=>nestedMatches(node,map.get(node.id),instance,state,templates,nextVisited));const node=ordered[index];for(const candidate of candidates.get(node.id)){if(used.has(candidate.id))continue;map.set(node.id,candidate.id);used.add(candidate.id);if(search(index+1))return true;used.delete(candidate.id);map.delete(node.id)}return false};
  const matched=search(0);if(!matched)return{matched:false,nodeIds:[],edgeIds:[],reason:'节点、关系方向或嵌套条件不匹配'};const nodeIds=[...map.values()],edgeIds=queryEdges.flatMap(queryEdge=>definition.edges.filter(edge=>edgeMatches(queryEdge,edge,map)).map(edge=>edge.id));return{matched:true,nodeIds,edgeIds,map:Object.fromEntries(map),definition,template};
}

export function searchStructureQuery(query,state,{pathFor=instance=>[state.knowledge.find(item=>item.id===instance.ownerKnowledgeId)?.title??'知识',instance.id]}={}){
  const results=[];for(const instance of state.structureInstances??[]){const match=matchStructureQuery(query,instance,state);if(!match.matched)continue;results.push({instanceId:instance.id,ownerKnowledgeId:instance.ownerKnowledgeId,templateId:instance.templateId,path:pathFor(instance),matchedNodeIds:match.nodeIds,matchedEdgeIds:match.edgeIds,definition:match.definition})}return results;
}

export function validateStructureQuery(query,{maxDepth=12}={}){const errors=[],visit=(value,depth)=>{if(depth>maxDepth){errors.push('查询嵌套深度过大');return}if(!['exact','contains','subgraph'].includes(value?.mode))errors.push('查询模式必须是 exact、contains 或 subgraph');for(const node of value?.nodes??[])if(node.nested)visit(node.nested,depth+1)};visit(query,0);return{valid:!errors.length,errors}}
