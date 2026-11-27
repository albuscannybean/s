import { list, transaction } from '../../apps/web/db.js';
import { buildLkl3ImportPlan, exportLkl3 } from '../lkl3/package.js';
import { exportStudyArchive, mergeStudySessions, validateStudyArchive } from '../learning/study-session.js';
import { mathCourseById } from '../learning/math-content.js';
import { readProgress, mergeReadingProgress } from '../learning/reading-progress.js';
import { TEXTBOOK_EDITIONS } from '../learning/textbook-editions.js';
import { allPageNotes,mergePageNotes } from './textbook-shelf.js';

const format='lmn-learning-backup/1';
function exportFile(data) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='LMN-学习与研究备份.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function parseBackup(value,archive) {
  if(value?.format!==format||typeof value.workspace!=='string'||!Array.isArray(value.annotations)
    ||value.annotations.length>20000||!Array.isArray(value.folders)||value.folders.length>2000
    ||!value.progress||Array.isArray(value.progress)||typeof value.progress!=='object')throw new Error('无法识别此学习备份。');
  const sessions=validateStudyArchive(value.study);
  const pagesByEdition=new Map(TEXTBOOK_EDITIONS.map(edition=>[edition.sha256,edition.pages]));
  const pageNotes=value.pageNotes??[];
  if(!Array.isArray(pageNotes)||pageNotes.length>20000
    ||new Set(pageNotes.map(note=>note?.id)).size!==pageNotes.length
    ||!pageNotes.every(note=>typeof note?.id==='string'&&note.id.length<=100&&typeof note.body==='string'
      &&note.body.length<=12000&&typeof note.quote==='string'&&note.quote.length<=6000
      &&typeof note.createdAt==='string'&&Number.isFinite(Date.parse(note.createdAt))
      &&Number.isInteger(note.page)&&note.page>0&&note.page<=pagesByEdition.get(note.edition)
      &&Array.isArray(note.rects)&&note.rects.length<=1200&&note.rects.every(rect=>
        Array.isArray(rect)&&rect.length===4&&rect.every(value=>Number.isFinite(value)&&value>=0&&value<=1))))
    throw new Error('备份含无效的教材原页批注。');
  const notes=value.annotations;
  if(new Set(notes.map(note=>note?.id)).size!==notes.length||!notes.every(note=>archive.validImportedAnnotation(note)))
    throw new Error('备份含无效的批注。');
  for(const folder of value.folders){
    if(typeof folder?.name!=='string'||!folder.name.trim()||folder.name.length>40||!Array.isArray(folder.items)
      ||!folder.items.every(id=>typeof id==='string'&&id.length<=120))throw new Error('备份含无效的收藏夹。');
  }
  for(const [courseId,saved] of Object.entries(value.progress)){
    const course=mathCourseById(courseId),sections=new Set(course?.chapters.flatMap(chapter=>chapter.groups.map(group=>group.id)));
    if(!sections.has(saved?.unitId)||!Number.isFinite(saved.at)||!Number.isFinite(saved.offset)||saved.offset<0
      ||!Array.isArray(saved.opened)||!saved.opened.every(id=>sections.has(id)))throw new Error('备份含无效的阅读位置。');
  }
  return {...value,sessions,pageNotes};
}

function previewBackup(backup,controller) {
  const plan=buildLkl3ImportPlan(backup.workspace,controller.state);
  if(!plan.committable)throw new Error(plan.errors.join(' · '));
  return plan;
}

export function bindLearningBackup(archive) {
  const root=document.querySelector('#mathLearningBackup');
  const controller=archive.controller;
  const element=selector=>root.querySelector(selector);
  const summary=element('[role=status]');
  const confirm=element('[data-backup-restore]');
  let pending;
  function status(message){summary.textContent=message;}

  element('[data-backup-export]').onclick=async()=>{
    try{
      exportFile({format,workspace:exportLkl3(controller.state,{title:'数学学习与研究'}),
        study:JSON.parse(exportStudyArchive(controller.studyWorkbench.sessions)),
        annotations:[...archive.annotations.values()],pageNotes:await allPageNotes(),
        folders:archive.collections.read(),progress:readProgress()});
      status('学习备份已生成。');
    }catch(error){status(error.message);}
  };
  element('input').onchange=async event=>{
    const file=event.target.files?.[0];
    event.target.value='';
    pending=null;
    confirm.disabled=true;
    if(!file)return;
    try{
      if(file.size>64*1024*1024)throw new Error('文件超过 64 MB。可分别使用 LKL 与学习档案导入。');
      const backup=parseBackup(JSON.parse(await file.text()),archive);
      const plan=previewBackup(backup,controller);
      pending=backup;
      status(`可恢复 ${backup.sessions.length} 个学习会话、${backup.annotations.length+backup.pageNotes.length} 条批注和 ${backup.folders.length} 个收藏夹。知识与结构有 ${plan.creates.length} 条新增、${plan.conflicts.length} 个同 ID 记录。确认后合并。`);
      confirm.disabled=false;
    }catch(error){status(error.message);}
  };
  confirm.onclick=async()=>{
    if(!pending)return;
    confirm.disabled=true;
    try{
      await archive.flushAnnotations();
      await controller.studyWorkbench.flushDrafts();
      const backup=pending, plan=previewBackup(backup,controller);
      const sessions=mergeStudySessions(await list('studySessions'),backup.sessions);
      const notes=new Map((await list('mathAnnotations')).map(note=>[note.id,note]));
      for(const note of backup.annotations)if(!notes.has(note.id)||notes.get(note.id).updatedAt<note.updatedAt)notes.set(note.id,note);
      const changes=[...plan.creates,...plan.updates];
      const stores=[...new Set([...changes.map(change=>change.store),'studySessions','mathAnnotations'])];
      await transaction(stores,tables=>{
        for(const {store,id} of changes)tables[store].put(plan.nextState[store].find(item=>item.id===id));
        for(const session of sessions)tables.studySessions.put(session);
        for(const note of notes.values())tables.mathAnnotations.put(note);
      });
      controller.state=plan.nextState;
      controller.studyWorkbench.sessions=sessions;
      archive.annotations=notes;
      archive.collections.merge(backup.folders);
      mergeReadingProgress(backup.progress);
      await mergePageNotes(backup.pageNotes);
      pending=null;
      controller.renderAll();
      status('已合并学习备份。');
    }catch(error){status(error.message);confirm.disabled=false;}
  };
}

