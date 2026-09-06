import {objectProfile,nestedProfiles} from '../domain/object-profile.js';
import {BUILTIN_TEMPLATES} from '../structure-engine/templates.js';
import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {validateInstance} from '../structure-engine/model.js';
import {validateV4Bundle} from '../structure-engine/migration.js';

import {LKL3_SCHEMA,RECORD_STORES} from './schema.js';
export {LKL3_SCHEMA,RECORD_STORES} from './schema.js';
const clone=value=>structuredClone(value),canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const encoded=value=>JSON.stringify(canonical(value));
const safeId=value=>typeof value==='string'&&value.length>0&&value.length<1000;

export function exportLkl3(state,{title='知识工作区',packageId='workspace',includeSettings=false}={}) {
 const records=[];
 for(const[kind,store]of Object.entries(RECORD_STORES)){
  if(kind==='settings'&&!includeSettings)continue;
  for(const data of state[store]??[])records.push({kind,id:data.id,profile:objectProfile(data,kind),members:nestedProfiles(data),data:clone(data)});
 }
 const document={schema:LKL3_SCHEMA,package:{id:packageId,title,roots:(state.knowledge??[]).map(k=>k.id)},records:records.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id))};
 return 'lkl 3\n'+JSON.stringify(canonical(document),null,2)+'\n';
}

function validateJson(value,depth=0) {
 if(depth>70)throw new Error('档案嵌套超过 70 层。');
 if(value&&typeof value==='object')for(const[key,child]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('档案包含不支持的属性名。');validateJson(child,depth+1);}
}
export function parseLkl3(source) {
 if(String(source).length>70*1024*1024)throw new Error('知识包超过 70 MB，请按知识范围拆分。');
 const match=String(source).match(/^\s*lkl\s+3\s*\n([\s\S]*)$/);if(!match)throw new Error('LKL 3 以 lkl 3 和换行开头。');
 let document;try{document=JSON.parse(match[1]);}catch(error){throw new Error('LKL 3 JSON 格式错误：'+error.message);}
 validateJson(document);
 if(document.schema!==LKL3_SCHEMA||!safeId(document.package?.id)||!Array.isArray(document.package.roots)||!Array.isArray(document.records))throw new Error('缺少正确的 schema、package.id、package.roots 或 records。');
 if(document.records.length>50000)throw new Error('知识包最多包含 50000 条顶层档案。');
 const seen=new Set();
 for(const record of document.records){
  if(!Object.hasOwn(RECORD_STORES,record.kind)||!safeId(record.id)||record.data?.id!==record.id)throw new Error('档案类型、ID 或 data.id 不一致。');
  const key=record.kind+':'+record.id;if(seen.has(key))throw new Error('重复档案 '+key);seen.add(key);
  if(record.profile?.schema!=='lmn.object-profile/1'||record.profile?.id!==record.id||record.profile?.kind!==record.kind)throw new Error('信息档案与对象身份不一致：'+key);
  const derived=objectProfile(record.data,record.kind);for(const field of ['sources','authors','evidenceStatus','scope','extensions'])if(encoded(record.profile[field])!==encoded(derived[field]))throw new Error('目录 '+key+'.profile.'+field+' 与 data 不一致；请在 data 的来源/作者字段或 data.profile 中保存元数据，并重新生成目录。');
  const derivedMembers=nestedProfiles(record.data);if(!Array.isArray(record.members))throw new Error('members 必须是数组。');for(const m of record.members){const expected=derivedMembers.find(x=>x.path===m.path);if(!expected||m.profile?.id!==expected.profile.id)throw new Error('嵌套目录路径或身份不一致：'+m.path);for(const field of ['sources','authors','evidenceStatus','scope','extensions'])if(encoded(m.profile[field])!==encoded(expected.profile[field]))throw new Error('嵌套目录元数据不一致：'+m.path+'；请编辑 data 中的对象元数据。');}record.profile=derived;record.members=derivedMembers;
  for(const member of record.members??[]){if(typeof member.path!=='string'||!member.path.startsWith('/')||!member.profile)throw new Error('嵌套对象档案缺少有效路径。');}
 }
 return document;
}
export function validateLkl3State(state,document) {
 const validation=validateV4Bundle({schemaVersion:4,...state}),errors=[...validation.errors];
 const by=(store)=>new Set((state[store]??[]).map(x=>x.id)),knowledge=by('knowledge'),instances=by('structureInstances'),contents=by('contentObjects'),views=by('structureViews'),boards=by('boards');
 for(const id of document.package.roots)if(!knowledge.has(id))errors.push('根知识不存在：'+id);
 const targetExists=(kind,id)=>({knowledge,structure:instances,content:contents,view:views,board:boards}[kind]?.has(id)??false);
 const graph=new Map(),parents=new Map(),construct=value=>(value.metadata?.placementMode??value.mode??'construct')==='construct';
 const addOwner=(parentType,parentId,type,id)=>{if(!targetExists(parentType,parentId)||!targetExists(type,id))return;const parent=parentType+':'+parentId,target=type+':'+id;graph.set(parent,new Set([...(graph.get(parent)??[]),target]));parents.set(target,new Set([...(parents.get(target)??[]),parent]));};
 for(const p of state.placements??[]){if(!targetExists(p.targetType,p.targetId)||!targetExists(p.parentType,p.parentId))errors.push('位置引用悬空：'+p.id);if(!['construct','reference'].includes(p.mode))errors.push('未知归属模式：'+p.id);if(construct(p))addOwner(p.parentType,p.parentId,p.targetType,p.targetId);}
 for(const i of state.structureInstances??[]){for(const binding of i.bindings??[])if(construct(binding))addOwner('structure',i.id,binding.targetType,binding.targetId);for(const c of Object.values(i.containers??{}))for(const child of c.children??[])if(child.persistence!=='runtime'&&construct(child))addOwner('structure',i.id,child.type==='formula'?'content':child.type,child.targetId);}
 for(const i of state.structureInstances??[])if(i.ownerKnowledgeId&&!parents.has('structure:'+i.id))addOwner('knowledge',i.ownerKnowledgeId,'structure',i.id);
 for(const board of state.boards??[])if(!parents.has('board:'+board.id))addOwner('knowledge',board.ownerKnowledgeId,'board',board.id);
 for(const[target,set]of parents)if(set.size>1)errors.push('对象有多个 construct 归属：'+target);
 const active=new Set(),done=new Set();function visit(id){if(active.has(id)){errors.push('construct 归属存在循环');return;}if(done.has(id))return;active.add(id);for(const child of graph.get(id)??[])visit(child);active.delete(id);done.add(id);}for(const id of graph.keys())visit(id);
 for(const r of state.representations??[]){if(!knowledge.has(r.knowledgeId))errors.push('表征所属知识不存在：'+r.id);const id=r.data?.instanceId??r.structureInstanceId;if(id&&!instances.has(id))errors.push('表征结构不存在：'+r.id);}
 for(const p of state.knowledgePackages??[])if(p.rootInternalId&&!knowledge.has(p.rootInternalId)&&!instances.has(p.rootInternalId)&&!boards.has(p.rootInternalId))errors.push('包入口不存在：'+p.id);
 const factories=new Set(BUILTIN_TEMPLATES.map(t=>t.slotFactory).filter(Boolean));for(const t of state.structureTemplates??[])if(t.slotFactory&&!factories.has(t.slotFactory))errors.push('运行时不支持工厂：'+t.slotFactory);
 const templates=state.structureTemplates??[];
 for(const instance of state.structureInstances??[]){
  if(instance.ownerKnowledgeId&&!knowledge.has(instance.ownerKnowledgeId))errors.push('结构的所属知识不存在：'+instance.id);
  try{const check=validateInstance(instance,templates,state.structureInstances,state.knowledge);errors.push(...check.errors);}catch(error){errors.push(instance.id+'：'+error.message);}
  let definition;try{definition=materializeInstanceDefinition(templates.find(t=>t.id===instance.templateId),instance)}catch{}
  const slots=new Set(definition?.slots?.map(s=>s.id)??[]),plots=new Set((instance.plotExpressions??[]).map(p=>p.id)),motions=new Set((instance.motionPoints??[]).map(m=>m.id)),primitives=new Set((instance.geometryPrimitives??[]).map(p=>p.id));
  for(const m of instance.motionPoints??[])if(!plots.has(m.plotId))errors.push('动点轨迹不存在：'+m.id);
  for(const p of instance.geometryPrimitives??[])for(const ref of p.operandRefs??p.pointRefs??[]){const known={slot:slots,motion:motions,plot:plots,geometry:primitives}[ref.type];if(known&&!known.has(ref.id))errors.push('几何操作数不存在：'+p.id+'/'+ref.id);}
  for(const container of Object.values(instance.containers??{}))for(const child of container.children??[]){
   if(child.targetId&&['knowledge','structure'].includes(child.type)&&!targetExists(child.type,child.targetId))errors.push('容器引用悬空：'+child.targetId);
   if(child.targetId&&['content','formula'].includes(child.type)&&!contents.has(child.targetId))errors.push('正文引用悬空：'+child.targetId);
  }
 }
 for(const view of state.structureViews??[])if(view.instanceId&&!instances.has(view.instanceId))errors.push('视图引用悬空：'+view.id);
 return [...new Set(errors)];
}
export function buildLkl3ImportPlan(source,current,{strategy='merge',copyId=null}={}) {
 const document=typeof source==='string'?parseLkl3(source):parseLkl3('lkl 3\n'+JSON.stringify(source)),state=clone(current),creates=[],updates=[],conflicts=[],warnings=[],copyErrors=[];
 if(!['merge','replace','copy'].includes(strategy))throw new Error('不支持的导入策略。');
 for(const store of Object.values(RECORD_STORES))state[store]??=[];
 const ids=new Map(),prefix=copyId??globalThis.crypto.randomUUID(),isBuiltin=r=>r.kind==='structure-template'&&(r.data.builtin||r.id.startsWith('builtin:'));
 const namespace=new Set();if(strategy==='copy')for(const r of document.records){if(!isBuiltin(r))ids.set(r.id,prefix+':'+r.id);if(r.data.packageId)namespace.add(r.data.packageId);}
 const remap=(value,key='')=>{
  if(Array.isArray(value))return value.map(v=>remap(v,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v,k)]));
  if(typeof value!=='string'||strategy!=='copy')return value;
  if(key==='packageId'&&namespace.has(value))return prefix+':'+value;
  if(['externalStableId','externalId','externalKey'].includes(key)&&value)return prefix+':'+value;
  return /(^id$|Id$|Ids$|^roots$)/.test(key)?(ids.get(value)??value):value;
 };
 const mapped=remap(document);mapped.package.roots=document.package.roots.map(id=>ids.get(id)??id);if(strategy==='copy')mapped.package.id=prefix+':'+document.package.id;
 for(const record of mapped.records){record.profile=objectProfile(record.data,record.kind);record.members=nestedProfiles(record.data);if(strategy==='copy'&&record.kind==='package'&&record.data.stableId)record.data.stableId=prefix+':'+record.data.stableId;
  const store=RECORD_STORES[record.kind],existing=state[store].findIndex(x=>x.id===record.id);
  if(strategy==='copy'&&isBuiltin(record)&&existing>=0){const local=state[store][existing],fields=['version','slotFactory','slots','edges','constraints','rules','variables'];if(fields.some(key=>encoded(local[key])!==encoded(record.data[key])))copyErrors.push('副本的内置模板与当前数学模型不兼容：'+record.id);else if(encoded(local)!==encoded(record.data))warnings.push('副本复用本地内置模板的显示设置：'+record.id);continue;}
  // Profile is restored only when it was part of the runtime object; generated
  // dossiers remain in the package instead of mutating data during a round trip.
  const incoming=clone(record.data);
  if(existing<0){state[store].push(incoming);creates.push({store,id:incoming.id});}
  else if(encoded(state[store][existing])!==encoded(incoming)){
   conflicts.push({store,id:incoming.id,localTitle:state[store][existing].title??state[store][existing].name,importTitle:incoming.title??incoming.name});
   state[store][existing]=strategy==='merge'?{...state[store][existing],...incoming}:incoming;updates.push({store,id:incoming.id});
  }
 }
 // Builtins omitted by a hand-authored minimal package resolve from this runtime.
 for(const template of BUILTIN_TEMPLATES)if(!state.structureTemplates.some(t=>t.id===template.id))state.structureTemplates.push(clone(template));
 const errors=[...copyErrors,...validateLkl3State(state,mapped)];
 return {kind:'lkl3',strategy,packageId:document.package.id,document:mapped,nextState:errors.length?clone(current):state,errors,warnings,conflicts,creates,updates,counts:Object.fromEntries(Object.entries(RECORD_STORES).map(([kind,store])=>[kind,mapped.records.filter(r=>r.kind===kind).length])),rootTarget:{type:'knowledge',id:mapped.package.roots[0]??null},committable:!errors.length};
}
