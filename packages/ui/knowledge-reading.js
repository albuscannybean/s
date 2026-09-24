import {createDocumentEditor} from './document-editor.js';
import {ensureObjectContent,normalizeObjectContent} from '../domain/semantic-container.js';
import {navigatorStructureRoots} from '../navigation/navigator-model.js';

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
export function installKnowledgeReading(Controller){
 Controller.prototype.readingContext=function(){
  if(!this.document.startsWith('structure:')||!this.instance)return null;
  return {instance:this.instance,knowledge:this.state.knowledge.find(k=>k.id===this.instance.ownerKnowledgeId)??null};
 };
 Controller.prototype.showReadingPane=function(source='knowledge'){
  const context=this.readingContext();if(!context)return;
  this.readingPane={instanceId:context.instance.id,source:context.knowledge?source:'structure'};this.renderKnowledgeReading();
 };
 Controller.prototype.renderKnowledgeReading=function(){
  const context=this.readingContext(),en=this.preferences.language==='en',say=(zh,english)=>en?english:zh;
  let controls=document.getElementById('knowledgeViewControls'),stage=document.getElementById('structureStage');
  if(!controls){
   controls=el('div','knowledge-view-controls');controls.id='knowledgeViewControls';document.querySelector('.canvas-actions').prepend(controls);
   stage=el('div','structure-stage');stage.id='structureStage';const canvas=document.getElementById('canvasViewport');canvas.before(stage);
   const panes=el('div','structure-panes');panes.id='structurePanes';stage.append(panes);panes.append(canvas);
   const reader=el('aside','knowledge-reader hidden');reader.id='knowledgeReader';reader.setAttribute('aria-label','正文');panes.append(reader);
  }
  const reader=document.getElementById('knowledgeReader'),wasOpen=stage.classList.contains('reading-open');
  controls.hidden=!context;stage.classList.toggle('hidden',!context);controls.replaceChildren();
  const open=!!context&&this.readingPane?.instanceId===context.instance.id;
  stage.classList.toggle('reading-open',open);reader.classList.toggle('hidden',!open);
  if(!context){reader.replaceChildren();this.readingEditorKey=null;return}
  const {instance,knowledge}=context,structures=knowledge?navigatorStructureRoots(this.state,knowledge.id):[instance];
  if(!structures.some(i=>i.id===instance.id))structures.push(instance);
  if(structures.length>1){
   const select=el('select');select.id='knowledgeStructureSelect';select.setAttribute('aria-label',say('选择结构','Choose structure'));
   for(const item of structures){const option=el('option','',this.structureDisplayTitle(item));option.value=item.id;select.append(option)}
   select.value=instance.id;select.onchange=()=>{const source=this.readingPane?.source;this.openInstance(select.value);if(open)this.showReadingPane(source)};controls.append(select);
  }
  const toggle=el('button','',say('正文','Notes'));toggle.id='toggleKnowledgeNotes';toggle.type='button';toggle.setAttribute('aria-controls','knowledgeReader');toggle.setAttribute('aria-expanded',String(open));
  toggle.onclick=()=>{if(open){this.readingPane=null;this.renderKnowledgeReading();document.getElementById('toggleKnowledgeNotes').focus()}else{this.showReadingPane();document.getElementById('readingSourceSelect')?.focus()}};controls.append(toggle);
  if(wasOpen!==open){this.fitPending=true;this.scheduler.request('reading-layout')}
  if(!open){reader.replaceChildren();this.readingEditorKey=null;return}
  const source=knowledge?this.readingPane.source:'structure',key=instance.id+':'+source+':'+(this.readingMode??'preview')+':'+this.preferences.language;
  if(key===this.readingEditorKey)return;this.readingEditorKey=key;reader.replaceChildren();
  const header=el('header','knowledge-reader-header'),select=el('select');select.id='readingSourceSelect';select.setAttribute('aria-label',say('正文来源','Notes source'));
  for(const [value,label]of [...(knowledge?[['knowledge',say('知识正文','Knowledge notes')]]:[]),['structure',say('当前结构说明','Structure notes')]]){const option=el('option','',label);option.value=value;select.append(option)}
  select.value=source;select.onchange=()=>{this.readingPane.source=select.value;this.renderKnowledgeReading();document.getElementById('readingSourceSelect').focus()};
  const close=el('button','',say('关闭正文','Close notes'));close.type='button';close.onclick=()=>{this.readingPane=null;this.renderKnowledgeReading();document.getElementById('toggleKnowledgeNotes').focus()};header.append(select,close);reader.append(header);
  const target=source==='knowledge'?knowledge:instance,content=ensureObjectContent(target);
  if(source==='knowledge'){content.body=knowledge.content??content.body??'';content.title=knowledge.title}
  const host=el('div','knowledge-reader-content');reader.append(host);
  host.append(createDocumentEditor(document,{language:this.preferences.language,content,mode:this.readingMode??'preview',contextLabel:source==='knowledge'?knowledge.title:this.structureDisplayTitle(instance),onModeChange:mode=>{this.readingMode=mode;this.renderKnowledgeReading()},onChange:next=>{
   target.objectContent=normalizeObjectContent(next);target.updatedAt=new Date().toISOString();
   if(source==='knowledge'){target.title=next.title||target.title;target.content=next.body;target.summary=next.summary}
   this.scheduleSave('reading:notes');
  },onDone:()=>close.click()}));
 };
}
