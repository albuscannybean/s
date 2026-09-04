import {patternSearch,structureSearch,textSearch} from '../search-engine/search.js';
import {buildSemanticIndex} from '../cognitive-runtime/semantic-index.js';
import {activateKnowledge} from '../cognitive-runtime/activation.js';

export class KnowledgeRepository{
  constructor(adapter,store='knowledge'){if(!adapter)throw new Error('A persistence adapter is required');this.adapter=adapter;this.store=store}
  list(){return this.adapter.list(this.store)}get(id){return this.adapter.get(this.store,id)}put(value){return this.adapter.put(this.store,value)}remove(id){return this.adapter.remove(this.store,id)}
}
export class RelationRepository extends KnowledgeRepository{constructor(adapter){super(adapter,'relations')}}
export class StructureRepository extends KnowledgeRepository{
  constructor(adapter){super(adapter,'structureInstances')}
  listTemplates(){return this.adapter.list('structureTemplates')}listInstances(){return this.adapter.list('structureInstances')}
  async transaction(callback){if(this.adapter.transaction)return this.adapter.transaction(['structureTemplates','structureInstances'],callback);return callback({templates:await this.listTemplates(),instances:await this.listInstances()})}
}
export class SearchRepository{
  constructor(stateProvider){this.stateProvider=stateProvider}
  async state(){return typeof this.stateProvider==='function'?await this.stateProvider():this.stateProvider}
  async text(query){return textSearch(query,await this.state())}async semantic(query,options){return buildSemanticIndex(await this.state()).search(query,options)}async activate(taskContext,options={}){const state=await this.state();return activateKnowledge({taskContext,state,...options})}async structure(criteria){return structureSearch(criteria,await this.state())}async pattern(pattern){return patternSearch(pattern,await this.state())}
}
