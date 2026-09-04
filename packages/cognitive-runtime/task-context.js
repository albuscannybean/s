const uid=()=>globalThis.crypto?.randomUUID?.()??`task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();
const strings=value=>[...new Set((Array.isArray(value)?value:value==null?[]:[value]).map(item=>String(item).trim()).filter(Boolean))];
const clone=value=>value==null?value:structuredClone(value);

export const TASK_CONTEXT_STORAGE_KEY='lmn-v4.3.1-task-context';

export function createTaskContext(input={}){
  const timestamp=now();
  return{id:input.id??uid(),goal:String(input.goal??''),taskType:String(input.taskType??'concept-understanding'),domainConstraints:strings(input.domainConstraints),focus:strings(input.focus),activeKnowledgeIds:strings(input.activeKnowledgeIds),learnerState:clone(input.learnerState??null),runtimeMetadata:clone(input.runtimeMetadata??{}),createdAt:input.createdAt??timestamp,updatedAt:timestamp};
}

export function updateTaskContext(context,patch={}){
  const next=createTaskContext({...context,...clone(patch),id:context?.id,createdAt:context?.createdAt});
  if(patch.domainConstraints===undefined)next.domainConstraints=strings(context?.domainConstraints);
  if(patch.focus===undefined)next.focus=strings(context?.focus);
  if(patch.activeKnowledgeIds===undefined)next.activeKnowledgeIds=strings(context?.activeKnowledgeIds);
  return next;
}

export class TaskContextStore{
  constructor(storage=globalThis.localStorage,key=TASK_CONTEXT_STORAGE_KEY){this.storage=storage;this.key=key}
  load(){try{const value=JSON.parse(this.storage?.getItem(this.key)??'null');return value?createTaskContext(value):createTaskContext()}catch{return createTaskContext()}}
  save(context){const normalized=updateTaskContext(context);this.storage?.setItem(this.key,JSON.stringify(normalized));return normalized}
  clear(){this.storage?.removeItem(this.key)}
}
