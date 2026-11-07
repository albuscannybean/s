/** A study outline is a view over ordinary Knowledge and construction placements.
 * No study-only records or schema extensions are required for LKL3 export.
 */
export const STUDY_KINDS=Object.freeze(['course','chapter','unit','practice','proof']);
const PREFIX='lmn-study:';
const own=placement=>(placement?.mode??placement?.metadata?.placementMode)!=='reference';

export const studyTag=kind=>STUDY_KINDS.includes(kind)?`${PREFIX}${kind}`:null;

export function studyKind(knowledge){
  const tags=knowledge?.objectContent?.tags??[];
  return STUDY_KINDS.find(kind=>tags.includes(studyTag(kind)))??null;
}

export function studyParentId(state,knowledgeId){
  const parent=(state.placements??[]).find(p=>own(p)&&p.targetType==='knowledge'&&p.targetId===knowledgeId);
  return parent?.parentType==='knowledge'?parent.parentId:null;
}

export function studyCatalog(state={}){
  const knowledge=new Map((state.knowledge??[]).map(item=>[item.id,item]));
  const byParent=new Map();
  for(const p of state.placements??[]){
    if(!own(p)||p.parentType!=='knowledge'||p.targetType!=='knowledge'||!knowledge.has(p.parentId)||!knowledge.has(p.targetId))continue;
    const items=byParent.get(p.parentId)??[];
    items.push({knowledge:knowledge.get(p.targetId),order:Number(p.order)||0});
    byParent.set(p.parentId,items);
  }
  const children=id=>(byParent.get(id)??[]).sort((a,b)=>a.order-b.order).map(entry=>entry.knowledge);
  return [...knowledge.values()].filter(item=>studyKind(item)==='course')
    .map(course=>({course,chapters:children(course.id).filter(item=>studyKind(item)==='chapter')
      .map(chapter=>({chapter,units:children(chapter.id).filter(item=>!["course","chapter"].includes(studyKind(item)))
        .map(unit=>({unit,activities:children(unit.id).filter(item=>['practice','proof'].includes(studyKind(item)))}))}))}));
}

/** Only an unowned note, or one already in a study chapter, may be reorganized. */
export function canPlaceInStudyChapter(state,knowledgeId){
  const record=(state.knowledge??[]).find(item=>item.id===knowledgeId);
  if(!record||['course','chapter','practice','proof'].includes(studyKind(record)))return false;
  const parents=(state.placements??[]).filter(p=>own(p)&&p.targetType==='knowledge'&&p.targetId===knowledgeId);
  if(parents.some(p=>p.parentType!=='knowledge'||studyKind((state.knowledge??[]).find(k=>k.id===p.parentId))!=='chapter'))return false;
  return !(state.structureInstances??[]).some(instance=>(instance.bindings??[]).some(binding=>binding.targetType==='knowledge'&&binding.targetId===knowledgeId&&own(binding)));
}

/** Validates hierarchy and ownership, then attaches or moves a Knowledge object. */
export function placeStudyKnowledge(state,parentId,childId,{idFactory=()=>globalThis.crypto.randomUUID()}={}){
  const parent=(state.knowledge??[]).find(item=>item.id===parentId);
  const child=(state.knowledge??[]).find(item=>item.id===childId);
  if(!parent||!child)throw new Error('学习目录中的知识不存在');
  const parentKind=studyKind(parent),childKind=studyKind(child);
  const archivedUnit=!parentKind&&studyKind((state.knowledge??[]).find(item=>item.id===studyParentId(state,parentId)))==='chapter';
  if(!((parentKind==='course'&&childKind==='chapter')||(parentKind==='chapter'&&(!childKind||childKind==='unit'))||((parentKind==='unit'||archivedUnit)&&['practice','proof'].includes(childKind))))throw new Error('学习目录层级不匹配');
  if(parentKind==='chapter'&&!canPlaceInStudyChapter(state,childId))throw new Error('该知识已经属于其他结构，无法直接移动');
  const existing=(state.placements??[]).filter(p=>own(p)&&p.targetType==='knowledge'&&p.targetId===childId);
  if(parentKind!=='chapter'&&(existing.length||(state.structureInstances??[]).some(i=>(i.bindings??[]).some(b=>b.targetType==='knowledge'&&b.targetId===childId&&own(b)))))throw new Error('知识已经存在构造归属');
  if(parentId===childId)throw new Error('知识不能归属于自身');
  const visited=new Set([childId]);let current=parentId;
  while(current){if(visited.has(current))throw new Error('学习目录中不能形成循环');visited.add(current);current=studyParentId(state,current)}
  state.placements=(state.placements??[]).filter(p=>!existing.includes(p));
  const order=state.placements.filter(p=>own(p)&&p.parentType==='knowledge'&&p.parentId===parentId).length;
  state.placements.push({id:idFactory(),parentType:'knowledge',parentId,targetType:'knowledge',targetId:childId,mode:'construct',order});
}

export function studyOverviewBody(kind,language='zh-CN'){
  if(language==='en')return kind==='course'?'## Learning goals\n\nWhat do I hope to understand and use?\n\n## Course map\n\nWhich chapters belong here?\n\n## Questions to revisit\n\n':'## Central questions\n\nWhat is this chapter about?\n\n## Prerequisites\n\nWhat must I know beforehand?\n\n## Check for understanding\n\nWhich proof or problem should I do independently?\n\n';
  return kind==='course'?'## 学习目标\n\n这门课程中，我希望真正理解和运用什么？\n\n## 课程脉络\n\n各章节如何衔接？\n\n## 待解决的问题\n\n':'## 本章核心问题\n\n这一章究竟在研究什么？\n\n## 前置知识\n\n我需要先掌握哪些定义或方法？\n\n## 独立检验\n\n哪些证明或题目能够检验我是否理解？\n\n';
}
