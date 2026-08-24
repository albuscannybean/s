export class KnowledgeRepository{async list(){throw new Error('Not implemented')}async get(id){throw new Error('Not implemented')}async put(value){throw new Error('Not implemented')}async remove(id){throw new Error('Not implemented')}}
export class RelationRepository extends KnowledgeRepository{}
export class StructureRepository extends KnowledgeRepository{async listTemplates(){throw new Error('Not implemented')}async listInstances(){throw new Error('Not implemented')}async transaction(callback){throw new Error('Not implemented')}}
export class SearchRepository{async text(query){throw new Error('Not implemented')}async structure(criteria){throw new Error('Not implemented')}async pattern(pattern){throw new Error('Not implemented')}}
