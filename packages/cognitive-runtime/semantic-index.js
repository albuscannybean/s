import {materializeInstanceDefinition} from '../structure-engine/model.js';

const normalize=value=>String(value??'').normalize('NFKC').toLowerCase();
const terms=value=>[...new Set(normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
const join=(...values)=>values.flat(Infinity).filter(value=>value!=null).map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' ');
const titleOf=(object,fallback='')=>object?.objectContent?.title||object?.title||object?.label||object?.name||fallback;

export class UnifiedSemanticIndex{
  constructor(state={}){this.records=new Map();this.inverted=new Map();this.rebuild(state)}
  clear(){this.records.clear();this.inverted.clear()}
  upsert(record){this.remove(record.key);const normalized={...record,text:join(record.title,record.text,record.tags,record.aliases,record.sources,record.role,record.type),tokens:terms(join(record.title,record.text,record.tags,record.aliases,record.sources,record.role,record.type))};this.records.set(normalized.key,normalized);for(const token of normalized.tokens){if(!this.inverted.has(token))this.inverted.set(token,new Set());this.inverted.get(token).add(normalized.key)}return normalized}
  remove(key){const previous=this.records.get(key);if(!previous)return false;for(const token of previous.tokens??[]){this.inverted.get(token)?.delete(key);if(!this.inverted.get(token)?.size)this.inverted.delete(token)}return this.records.delete(key)}
  rebuild(state={}){
    this.clear();const knowledgeById=new Map((state.knowledge??[]).map(item=>[item.id,item]));
    for(const item of state.knowledge??[])this.upsert({key:`knowledge:${item.id}`,kind:'knowledge',id:item.id,knowledgeId:item.id,title:titleOf(item),text:join(item.content,item.summary,item.objectContent?.summary,item.objectContent?.body,item.objectContent?.displayFormula),tags:item.objectContent?.tags??item.tags,aliases:item.aliases,sources:item.objectContent?.sources??item.sources});
    for(const item of state.relations??[])this.upsert({key:`relation:${item.id}`,kind:'relation',id:item.id,title:titleOf(item,item.label||item.type),text:join(item.label,item.type,item.objectContent?.summary,item.objectContent?.body),tags:item.objectContent?.tags,sources:item.objectContent?.sources,sourceId:item.sourceId,targetId:item.targetId,knowledgeId:knowledgeById.has(item.sourceId)?item.sourceId:null});
    for(const item of state.contentObjects??[])this.upsert({key:`content:${item.id}`,kind:'content',id:item.id,knowledgeId:item.knowledgeId??item.ownerKnowledgeId??null,title:titleOf(item,item.id),text:join(item.body,item.summary,item.objectContent?.body,item.objectContent?.summary,item.objectContent?.displayFormula),tags:item.objectContent?.tags??item.tags,aliases:item.aliases,sources:item.objectContent?.sources??item.sources,type:item.objectContent?.contentType??item.contentType});
    const templates=new Map((state.structureTemplates??[]).map(item=>[item.id,item]));
    for(const instance of state.structureInstances??[]){const template=templates.get(instance.templateId);if(!template)continue;const definition=materializeInstanceDefinition(template,instance);this.upsert({key:`structure:${instance.id}`,kind:'structure',id:instance.id,knowledgeId:instance.ownerKnowledgeId,title:titleOf(instance,template.name),text:join(template.name,template.category,template.semanticMetadata,instance.parameters),tags:instance.objectContent?.tags,sources:instance.objectContent?.sources,type:template.id});for(const slot of definition.slots??[]){const container=instance.containers?.[slot.id];this.upsert({key:`slot:${instance.id}:${slot.id}`,kind:'slot',id:slot.id,instanceId:instance.id,knowledgeId:instance.ownerKnowledgeId,title:container?.localDisplayTitle||container?.content?.title||slot.label||slot.id,text:join(container?.content?.summary,container?.content?.body,container?.children?.map(child=>[child.content?.title,child.content?.summary,child.content?.body,child.metadata])),tags:container?.content?.tags,sources:container?.content?.sources,role:slot.role,type:slot.semanticCoordinate});}}
    return this;
  }
  search(query,{limit=40,kinds=null}={}){
    const source=normalize(query).trim();if(!source)return[];const queryTerms=terms(source),allowed=kinds?new Set(kinds):null,candidates=new Set();for(const term of queryTerms)for(const[token,keys]of this.inverted)if(token.includes(term)||term.includes(token))for(const key of keys)candidates.add(key);if(!candidates.size)for(const key of this.records.keys())candidates.add(key);
    return[...candidates].map(key=>{const record=this.records.get(key),haystack=normalize(record.text),title=normalize(record.title);if(allowed&&!allowed.has(record.kind))return null;let score=0;const reasons=[];if(title===source){score+=12;reasons.push('标题完全匹配')}else if(title.startsWith(source)){score+=8;reasons.push('标题前缀匹配')}else if(title.includes(source)){score+=6;reasons.push('标题匹配')}for(const term of queryTerms)if(haystack.includes(term)){score+=2;reasons.push(`语义词：${term}`)}if(!score)return null;return{...record,score,reasons:[...new Set(reasons)]}}).filter(Boolean).sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind)||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(0,limit));
  }
}

export const buildSemanticIndex=state=>new UnifiedSemanticIndex(state);
