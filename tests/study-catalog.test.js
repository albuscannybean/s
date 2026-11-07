import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledge} from '../packages/domain/core.js';
import {exportLkl3,buildLkl3ImportPlan} from '../packages/lkl3/package.js';
import {canPlaceInStudyChapter,placeStudyKnowledge,studyCatalog,studyKind,studyOverviewBody,studyParentId,studyTag} from '../packages/ui/study-catalog.js';

const item=(name,kind=null)=>{
  const record=createKnowledge(name);
  if(kind)record.objectContent.tags.push(studyTag(kind));
  return record;
};

function fixture(){
  const [course,chapter,unit,problem,proof,existing,foreign]=[
    item('数学分析','course'),item('函数项级数','chapter'),item('一致收敛','unit'),
    item('证明 Weierstrass 判别法','proof'),item('一致收敛的反例','practice'),
    item('旧笔记'),item('其他结构中的知识')
  ];
  const state={knowledge:[course,chapter,unit,problem,proof,existing,foreign],placements:[],structureInstances:[]};
  let serial=0;const idFactory=()=>`study-placement-${++serial}`;
  return{state,course,chapter,unit,problem,proof,existing,foreign,idFactory};
}

test('study catalog uses Knowledge identities and construction placements for its four levels',()=>{
  const {state,course,chapter,unit,problem,proof,idFactory}=fixture();
  placeStudyKnowledge(state,course.id,chapter.id,{idFactory});
  placeStudyKnowledge(state,chapter.id,unit.id,{idFactory});
  placeStudyKnowledge(state,unit.id,problem.id,{idFactory});
  placeStudyKnowledge(state,unit.id,proof.id,{idFactory});
  const catalog=studyCatalog(state);
  assert.equal(catalog[0].course.id,course.id);
  assert.equal(catalog[0].chapters[0].chapter.id,chapter.id);
  assert.equal(catalog[0].chapters[0].units[0].unit.id,unit.id);
  assert.deepEqual(catalog[0].chapters[0].units[0].activities.map(item=>item.id),[problem.id,proof.id]);
  assert.equal(studyParentId(state,unit.id),chapter.id);
  assert.ok(state.placements.every(p=>p.mode==='construct'&&p.parentType==='knowledge'&&p.targetType==='knowledge'));
});

test('existing notes can be moved between chapters without deleting their contents',()=>{
  const {state,course,chapter,existing,problem,idFactory}=fixture(),second=item('微积分基础','chapter');
  state.knowledge.push(second);
  placeStudyKnowledge(state,course.id,chapter.id,{idFactory});
  placeStudyKnowledge(state,course.id,second.id,{idFactory});
  existing.content='原来的证明和例题';
  placeStudyKnowledge(state,chapter.id,existing.id,{idFactory});
  assert.equal(studyParentId(state,existing.id),chapter.id);
  placeStudyKnowledge(state,second.id,existing.id,{idFactory});
  assert.equal(studyParentId(state,existing.id),second.id);
  assert.equal(state.placements.filter(p=>p.targetId===existing.id).length,1);
  assert.equal(state.knowledge.find(item=>item.id===existing.id).content,'原来的证明和例题');
  assert.equal(studyKind(existing),null);
  placeStudyKnowledge(state,existing.id,problem.id,{idFactory});
  assert.equal(studyCatalog(state)[0].chapters[1].units[0].activities[0].id,problem.id);
});

test('study placement rejects wrong levels, foreign ownership, and duplicate ownership',()=>{
  const {state,course,chapter,unit,problem,foreign,idFactory}=fixture();
  assert.throws(()=>placeStudyKnowledge(state,chapter.id,course.id,{idFactory}),/层级/);
  assert.throws(()=>placeStudyKnowledge(state,course.id,unit.id,{idFactory}),/层级/);
  placeStudyKnowledge(state,course.id,chapter.id,{idFactory});
  placeStudyKnowledge(state,chapter.id,unit.id,{idFactory});
  assert.throws(()=>placeStudyKnowledge(state,chapter.id,problem.id,{idFactory}),/层级/);
  state.placements.push({id:'foreign-parent',parentType:'structure',parentId:'other',targetType:'knowledge',targetId:foreign.id,mode:'construct'});
  assert.equal(canPlaceInStudyChapter(state,foreign.id),false);
  assert.throws(()=>placeStudyKnowledge(state,chapter.id,foreign.id,{idFactory}),/其他结构/);
  assert.throws(()=>placeStudyKnowledge(state,course.id,chapter.id,{idFactory}),/归属/);
});

test('course outline and notes survive LKL3 export/import unchanged',()=>{
  const {state,course,chapter,unit,problem,idFactory}=fixture();
  placeStudyKnowledge(state,course.id,chapter.id,{idFactory});
  placeStudyKnowledge(state,chapter.id,unit.id,{idFactory});
  placeStudyKnowledge(state,unit.id,problem.id,{idFactory});
  chapter.objectContent.body=studyOverviewBody('chapter');
  const exported=exportLkl3(state);
  const plan=buildLkl3ImportPlan(exported,{});
  assert.equal(plan.committable,true,plan.errors.join('; '));
  const catalog=studyCatalog(plan.nextState);
  assert.equal(catalog[0].chapters[0].units[0].activities[0].id,problem.id);
  assert.equal(catalog[0].chapters[0].chapter.objectContent.body,chapter.objectContent.body);
  assert.equal(studyKind(catalog[0].course),'course');
});
