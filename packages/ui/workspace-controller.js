import {createKnowledge} from '../domain/core.js';
import {BUILTIN_TEMPLATES,materializeTemplate} from '../structure-engine/templates.js';
import {bindTarget,createStructureInstance,nestedStructureCycle,removeBinding} from '../structure-engine/model.js';
import {runInstance} from '../structure-engine/evaluator.js';
import {exportV3Bundle,importV3Bundle} from '../structure-engine/bundle.js';
import {migrateV2ToV3} from '../structure-engine/migration.js';
import {patternSearch,structureSearch,textSearch} from '../search-engine/search.js';
import {list,loadV3State,put,replaceAll} from '../../apps/web/db.js';
import {renderNestedPreview,renderStructure} from './structure-renderer.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const clone=value=>structuredClone(value);
const uid=()=>globalThis.crypto?.randomUUID?.()??`v3-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();

export class WorkspaceController{
  constructor(){
    this.state={knowledge:[],relations:[],representations:[],structureTemplates:[],structureInstances:[]};
    this.currentKnowledgeId=null;this.currentInstanceId=null;this.selectedSlotId=null;this.inspectorTab='semantics';this.libraryMode='insert';this.pendingSlot=null;this.zoom=1;this.pan={x:0,y:0};this.undoStack=[];this.redoStack=[];this.activeSearchTab='text';this.pendingImport=null;this.nestedPath=[];
  }

  async start(){
    await this.loadAndMigrate();this.bindUI();this.renderAll();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  async loadAndMigrate(){
    const loaded=await loadV3State(),migrationState=await list('migrationState');
    if(!migrationState.some(item=>item.id==='v2-to-v3')){
      const [lmns,structures]=await Promise.all([list('lmns'),list('structures')]);
      if(lmns.length||structures.length){
        const migrated=migrateV2ToV3({...loaded,lmns,structures,schema_version:2});
        await replaceAll(migrated,['knowledge','relations','representations','structureTemplates','structureInstances']);
        await put('migrationState',{id:'v2-to-v3',completedAt:now(),legacyLMNs:lmns.length,legacyStructures:structures.length});
        Object.assign(loaded,migrated);
      }else await put('migrationState',{id:'v2-to-v3',completedAt:now(),legacyLMNs:0,legacyStructures:0});
    }
    const templates=new Map([...BUILTIN_TEMPLATES,...(loaded.structureTemplates??[])].map(template=>[template.id,template]));
    this.state={...loaded,structureTemplates:[...templates.values()]};
    await Promise.all(BUILTIN_TEMPLATES.map(template=>put('structureTemplates',template)));
  }

  bindUI(){
    $('#newKnowledge').addEventListener('click',()=>this.createKnowledge());
    $('#insertStructure').addEventListener('click',()=>this.openLibrary('insert'));
    $('#browseLibrary').addEventListener('click',()=>this.openLibrary('insert'));
    $('#globalSearch').addEventListener('click',()=>this.openSearch());
    $('#exportBtn').addEventListener('click',()=>this.exportBundle());
    $('#importBtn').addEventListener('click',()=>$('#fileInput').click());
    $('#fileInput').addEventListener('change',event=>this.previewImport(event.target.files[0]));
    $('#confirmImport').addEventListener('click',()=>this.confirmImport());
    $('#toggleExplorer').addEventListener('click',()=>this.togglePanel('explorer'));
    $('#toggleInspector').addEventListener('click',()=>this.togglePanel('inspector'));
    $('#focusBtn').addEventListener('click',()=>this.toggleFocus());
    $('#fitBtn').addEventListener('click',()=>this.fitView());
    $('#zoomIn').addEventListener('click',()=>this.setZoom(this.zoom+.1));
    $('#zoomOut').addEventListener('click',()=>this.setZoom(this.zoom-.1));
    $('#zoomReset').addEventListener('click',()=>this.setZoom(1));
    $('#undoBtn').addEventListener('click',()=>this.undo());$('#redoBtn').addEventListener('click',()=>this.redo());
    $('#filterKnowledge').addEventListener('input',()=>this.renderExplorer());
    $('#librarySearch').addEventListener('input',()=>this.renderLibrary());$('#libraryCategory').addEventListener('change',()=>this.renderLibrary());
    $('#newTemplate').addEventListener('click',()=>{$('#structureLibrary').close();$('#builderDialog').showModal()});
    $('#saveTemplate').addEventListener('click',()=>this.saveCustomTemplate());
    $('#pickerSearch').addEventListener('input',()=>this.renderPicker());
    $('#pickerNewKnowledge').addEventListener('click',()=>this.createKnowledge(true));
    $('#pickerNestedStructure').addEventListener('click',()=>{$('#pickerDialog').close();this.openLibrary('nested')});
    $$('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
    $$('.inspector-tabs button').forEach(button=>button.addEventListener('click',()=>{this.inspectorTab=button.dataset.tab;this.renderInspector()}));
    $$('.search-tabs button').forEach(button=>button.addEventListener('click',()=>{this.activeSearchTab=button.dataset.searchTab;this.renderSearchForm()}));
    $$('[data-welcome]').forEach(button=>button.addEventListener('click',()=>button.dataset.welcome==='knowledge'?this.createKnowledge():button.dataset.welcome==='library'?this.openLibrary('insert'):$('#fileInput').click()));
    $$('[data-template]').forEach(button=>button.addEventListener('click',()=>this.insertTemplate(button.dataset.template)));
    document.addEventListener('keydown',event=>this.keydown(event));
    window.addEventListener('resize',()=>this.renderWorkspace());
    this.bindPanZoom();
  }

  bindPanZoom(){
    const viewport=$('#canvasViewport');let dragging=false,start=null;
    viewport.addEventListener('wheel',event=>{event.preventDefault();this.setZoom(this.zoom+(event.deltaY<0?.1:-.1))},{passive:false});
    viewport.addEventListener('pointerdown',event=>{if(event.target.closest('[data-slot-id]'))return;dragging=true;start={x:event.clientX-this.pan.x,y:event.clientY-this.pan.y};viewport.setPointerCapture(event.pointerId);viewport.style.cursor='grabbing'});
    viewport.addEventListener('pointermove',event=>{if(!dragging)return;this.pan={x:event.clientX-start.x,y:event.clientY-start.y};this.applyTransform()});
    viewport.addEventListener('pointerup',()=>{dragging=false;viewport.style.cursor='grab'});
  }

  keydown(event){
    const typing=/INPUT|TEXTAREA|SELECT/.test(event.target.tagName);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();this.openSearch();return}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?this.redo():this.undo();return}
    if(event.key==='Escape'&&$('#appShell').classList.contains('focus-mode'))this.toggleFocus(false);
    if(!typing&&event.key.toLowerCase()==='n')this.createKnowledge();
  }

  checkpoint(){this.undoStack.push(clone(this.state));if(this.undoStack.length>40)this.undoStack.shift();this.redoStack=[]}
  async undo(){if(!this.undoStack.length)return;this.redoStack.push(clone(this.state));this.state=this.undoStack.pop();await this.persistState();this.renderAll()}
  async redo(){if(!this.redoStack.length)return;this.undoStack.push(clone(this.state));this.state=this.redoStack.pop();await this.persistState();this.renderAll()}
  async persistState(){this.saving();await replaceAll(this.state,['knowledge','relations','representations','structureTemplates','structureInstances']);this.saved()}
  saving(){$('#saveStatus').textContent='◌ 正在保存…'}
  saved(){$('#saveStatus').textContent=`● 已保存 ${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`}

  async createKnowledge(bindPending=false){
    this.checkpoint();const count=this.state.knowledge.length+1,item=createKnowledge(`Untitled Knowledge ${count}`);item.summary='';item.aliases=[];item.favorite=false;this.state.knowledge.push(item);await put('knowledge',item);
    if(bindPending&&this.pendingSlot){await this.bindPending('knowledge',item.id);$('#pickerDialog').close()}else this.selectKnowledge(item.id);
    this.renderAll();this.saved();
  }

  selectKnowledge(id){this.currentKnowledgeId=id;this.currentInstanceId=this.instancesForKnowledge(id)[0]?.id??null;this.selectedSlotId=null;this.nestedPath=[];this.renderAll()}
  selectInstance(id,retainOwner=false){const instance=this.instance(id);this.currentInstanceId=id;if(!retainOwner)this.currentKnowledgeId=instance?.ownerKnowledgeId??null;this.selectedSlotId=null;this.renderAll()}
  instance(id){return this.state.structureInstances.find(item=>item.id===id)}
  template(id){return this.state.structureTemplates.find(item=>item.id===id)}
  instancesForKnowledge(id){return this.state.structureInstances.filter(item=>item.ownerKnowledgeId===id)}

  openLibrary(mode='insert'){this.libraryMode=mode;this.renderLibrary();$('#structureLibrary').showModal()}
  renderLibrary(){
    const query=$('#librarySearch').value.trim().toLowerCase(),category=$('#libraryCategory').value,grid=$('#templateGrid');grid.replaceChildren();
    const templates=this.state.structureTemplates.filter(template=>(!category||template.category===category)&&(!query||`${template.name} ${template.description} ${template.category}`.toLowerCase().includes(query)));
    for(const template of templates){const card=document.createElement('article');card.className='template-card';card.style.setProperty('--accent',template.visual?.accent??'#2f7658');card.innerHTML=`<div class="template-preview">${this.templateGlyph(template)}</div>`;const name=document.createElement('h3');name.textContent=template.name;const description=document.createElement('p');description.textContent=template.description;const meta=document.createElement('div');meta.className='template-meta';meta.textContent=`${template.category} · ${template.slotFactory?'dynamic':template.slots.length+' slots'} · ${template.computable?'executable':'semantic'}`;card.append(name,description,meta);card.addEventListener('click',()=>this.insertTemplate(template.id));grid.append(card)}
  }
  templateGlyph(template){return({lmn:'4·3·2',modular:'ℤₙ',poset:'≤',venn:'∩',geometry:'⬡',algebra:'∘',coordinate:'(x,y)',graph:'→',custom:'＋'})[template.category]??'⬡'}

  async insertTemplate(templateId){
    const template=this.template(templateId);if(!template)return;
    this.checkpoint();const owner=this.libraryMode==='nested'?null:this.currentKnowledgeId,instance=createStructureInstance(template,owner);
    if(template.computable)runInstance(instance,materializeTemplate(template,instance.parameters));
    this.state.structureInstances.push(instance);await put('structureInstances',instance);
    if(this.libraryMode==='nested'&&this.pendingSlot){await this.bindPending('structure',instance.id);this.nestedPath.push(instance.id)}
    this.currentInstanceId=instance.id;if(owner)this.currentKnowledgeId=owner;this.selectedSlotId=null;$('#structureLibrary').close();this.renderAll();this.saved();
  }

  selectSlot(slotId){this.selectedSlotId=slotId;this.renderWorkspace();this.renderInspector();const instance=this.instance(this.currentInstanceId),bound=(instance?.bindings??[]).some(binding=>binding.slotId===slotId);if(!bound)this.openPicker()}
  openPicker(){if(!this.currentInstanceId||!this.selectedSlotId)return;this.pendingSlot={instanceId:this.currentInstanceId,slotId:this.selectedSlotId};$('#pickerTitle').textContent=`Bind ${this.selectedSlotId}`;$('#pickerSearch').value='';this.renderPicker();$('#pickerDialog').showModal()}
  renderPicker(){
    const query=$('#pickerSearch').value.toLowerCase(),results=$('#pickerResults');results.replaceChildren();
    for(const item of this.state.knowledge.filter(item=>!query||item.title.toLowerCase().includes(query))){const row=document.createElement('button');row.className='picker-row';row.textContent=`◇ ${item.title}`;row.addEventListener('click',async()=>{await this.bindPending('knowledge',item.id);$('#pickerDialog').close()});results.append(row)}
    for(const item of this.state.structureInstances.filter(item=>item.id!==this.pendingSlot?.instanceId)){const template=this.template(item.templateId),title=template?.name??item.id;if(query&&!title.toLowerCase().includes(query))continue;const row=document.createElement('button');row.className='picker-row';row.textContent=`⬡ ${title}`;row.addEventListener('click',async()=>{await this.bindPending('structure',item.id);$('#pickerDialog').close()});results.append(row)}
  }
  async bindPending(targetType,targetId){
    const pending=this.pendingSlot;if(!pending)return;const instance=this.instance(pending.instanceId),template=this.template(instance.templateId);if(targetType==='structure'&&nestedStructureCycle(this.state.structureInstances,instance.id,targetId)){alert('This binding would create a nested Structure cycle.');return}
    this.checkpoint();bindTarget(instance,template,pending.slotId,targetType,targetId);await put('structureInstances',instance);this.currentInstanceId=instance.id;this.pendingSlot=null;this.renderAll();this.saved();
  }
  openNested(instanceId,slotId){this.nestedPath.push({parentId:this.currentInstanceId,slotId});this.currentInstanceId=instanceId;this.selectedSlotId=null;this.renderAll()}

  renderAll(){this.renderExplorer();this.renderWorkspace();this.renderInspector();this.renderBreadcrumbs();this.renderStatus()}
  renderExplorer(){
    const query=$('#filterKnowledge').value.trim().toLowerCase(),knowledgeList=$('#knowledgeList'),structureList=$('#structureList');knowledgeList.replaceChildren();structureList.replaceChildren();
    const knowledge=this.state.knowledge.filter(item=>!query||`${item.title} ${item.summary??''}`.toLowerCase().includes(query));$('#knowledgeCount').textContent=knowledge.length;$('#structureCount').textContent=this.state.structureInstances.length;
    for(const item of knowledge){const node=document.createElement('div');node.className=`explorer-item${item.id===this.currentKnowledgeId?' active':''}`;node.textContent=item.title;const count=document.createElement('small');count.textContent=`${this.instancesForKnowledge(item.id).length} structures · ${item.favorite?'★':'local'}`;node.append(count);node.addEventListener('click',()=>this.selectKnowledge(item.id));knowledgeList.append(node)}
    for(const instance of this.state.structureInstances){const template=this.template(instance.templateId),node=document.createElement('div');node.className=`explorer-item${instance.id===this.currentInstanceId?' active':''}`;node.innerHTML='<span class="structure-dot"></span>';node.append(document.createTextNode(template?.name??instance.id));const owner=this.state.knowledge.find(item=>item.id===instance.ownerKnowledgeId);node.append(Object.assign(document.createElement('small'),{textContent:owner?.title??'Standalone Structure'}));node.addEventListener('click',()=>this.selectInstance(instance.id));structureList.append(node)}
  }

  renderWorkspace(){
    const knowledge=this.state.knowledge.find(item=>item.id===this.currentKnowledgeId),instance=this.instance(this.currentInstanceId),template=this.template(instance?.templateId);
    $('#workspaceKind').textContent=instance?'STRUCTURE INSTANCE':knowledge?'KNOWLEDGE':'WORKSPACE';$('#workspaceTitle').textContent=instance?template?.name:knowledge?.title??'Knowledge Workspace';
    this.renderInstanceTabs();
    const hasContent=Boolean(instance);$('#welcome').classList.toggle('hidden',hasContent);$('#canvasViewport').classList.toggle('hidden',!hasContent);
    if(!hasContent){
      const title=$('#welcome h2'),body=$('#welcome p');title.textContent=knowledge?knowledge.title:'让知识进入可运行的结构';body.textContent=knowledge?'这个 Knowledge 目前没有 Structure。它仍然是独立且完整的语义实体；需要时再插入 LMN、图、代数或几何结构。':'Knowledge 是语义实体；Structure 是可复用、可嵌套、可计算的形式骨架。';return;
    }
    const resolved=renderStructure({container:$('#structureCanvas'),edgeLayer:$('#edgeLayer'),instance,template,knowledge:this.state.knowledge,instances:this.state.structureInstances,templates:this.state.structureTemplates,selectedSlotId:this.selectedSlotId,scale:this.zoom,onSelectSlot:slotId=>this.selectSlot(slotId),onOpenNested:(id,slot)=>this.openNested(id,slot)});
    runInstance(instance,resolved);this.applyTransform();
    const nested=(instance.bindings??[]).find(binding=>binding.targetType==='structure'),nestedInstance=this.instance(nested?.targetId);renderNestedPreview($('#nestedCanvas'),nestedInstance,this.template(nestedInstance?.templateId));
  }
  renderInstanceTabs(){const tabs=$('#instanceTabs');tabs.replaceChildren();for(const instance of this.instancesForKnowledge(this.currentKnowledgeId)){const template=this.template(instance.templateId),button=document.createElement('button');button.className=`instance-tab${instance.id===this.currentInstanceId?' active':''}`;button.textContent=template?.name??'Structure';button.addEventListener('click',()=>this.selectInstance(instance.id,true));tabs.append(button)}}

  renderBreadcrumbs(){
    const nav=$('#breadcrumbs');nav.replaceChildren();const add=(text,click)=>{const button=document.createElement('button');button.className='icon-button';button.textContent=text;if(click)button.addEventListener('click',click);nav.append(button)};add('Workspace',()=>{this.currentKnowledgeId=null;this.currentInstanceId=null;this.renderAll()});
    const knowledge=this.state.knowledge.find(item=>item.id===this.currentKnowledgeId);if(knowledge)add(`› ${knowledge.title}`,()=>this.selectKnowledge(knowledge.id));
    for(const step of this.nestedPath){const id=typeof step==='string'?step:step.parentId,instance=this.instance(id);add(`› ${this.template(instance?.templateId)?.name??'Structure'}`,()=>this.selectInstance(id,true))}
    const instance=this.instance(this.currentInstanceId);if(instance)add(`› ${this.template(instance.templateId)?.name??'Structure'}`);
  }
  renderStatus(){$('#pathStatus').textContent=`Recursive Depth: ${this.nestedPath.length} · ${this.currentKnowledgeId?'Knowledge':'Workspace'}`;$('#selectionStatus').textContent=this.selectedSlotId?`Slot: ${this.selectedSlotId}`:this.currentInstanceId?'Structure selected':'未选择';const instance=this.instance(this.currentInstanceId),errors=Object.keys(instance?.runtimeState?.errors??{});$('#runtimeStatus').textContent=errors.length?`Runtime: ${errors.length} error(s)`:'Runtime ready'}

  renderInspector(){
    $$('.inspector-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.tab===this.inspectorTab));const root=$('#inspectorContent');root.replaceChildren();const knowledge=this.state.knowledge.find(item=>item.id===this.currentKnowledgeId),instance=this.instance(this.currentInstanceId),template=this.template(instance?.templateId),resolved=template&&instance?materializeTemplate(template,instance.parameters):null,slot=resolved?.slots.find(item=>item.id===this.selectedSlotId);
    if(!knowledge&&!instance){root.append(this.heading('Workspace'),this.paragraph('Create a Knowledge or insert a reusable Structure to begin.'));return}
    if(this.inspectorTab==='semantics')this.inspectorSemantics(root,{knowledge,instance,template,slot});
    else if(this.inspectorTab==='relations')this.inspectorRelations(root,{knowledge,instance,template,slot});
    else if(this.inspectorTab==='rules')this.inspectorRules(root,{instance,template});
    else if(this.inspectorTab==='notes')this.inspectorNotes(root,{knowledge,instance});
    else this.inspectorAppearance(root,{instance,template});
  }
  heading(text){const node=document.createElement('h2');node.textContent=text;return node}
  paragraph(text){const node=document.createElement('p');node.textContent=text;return node}
  field(label,value,onChange,{type='text',readonly=false}={}){const wrap=document.createElement('div');wrap.className='field';const name=document.createElement('label');name.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');input.value=value??'';input.readOnly=readonly;input.addEventListener('change',()=>onChange?.(input.value));wrap.append(name,input);return wrap}

  inspectorSemantics(root,{knowledge,instance,template,slot}){
    if(slot){root.append(this.heading(slot.label),this.paragraph(`Role: ${slot.role}`),this.paragraph(`Semantic coordinate: ${JSON.stringify(slot.semanticCoordinate)}`));const bind=document.createElement('button');bind.textContent='Bind / Replace target';bind.addEventListener('click',()=>this.openPicker());root.append(bind);for(const binding of instance.bindings.filter(item=>item.slotId===slot.id)){const row=document.createElement('div');row.className='rule-card';row.append(this.paragraph(`${binding.targetType} → ${binding.targetId}`));const remove=document.createElement('button');remove.textContent='Remove binding';remove.addEventListener('click',async()=>{this.checkpoint();removeBinding(instance,binding.id);await put('structureInstances',instance);this.renderAll();this.saved()});row.append(remove);root.append(row)}return}
    if(instance){root.append(this.heading(template.name),this.paragraph(template.description),this.field('Instance UUID',instance.id,null,{readonly:true}),this.field('Owner Knowledge',knowledge?.title??'Standalone',null,{readonly:true}));return}
    root.append(this.heading(knowledge.title),this.field('Name',knowledge.title,async value=>{knowledge.title=value.trim()||knowledge.title;knowledge.updatedAt=now();await put('knowledge',knowledge);this.renderAll();this.saved()}),this.field('Summary',knowledge.summary??'',async value=>{knowledge.summary=value;knowledge.updatedAt=now();await put('knowledge',knowledge);this.saved()},{type:'textarea'}),this.field('UUID',knowledge.id,null,{readonly:true}));
  }
  inspectorRelations(root,{knowledge,instance,template,slot}){root.append(this.heading('Relations'));if(slot)root.append(this.paragraph(`${template.edges.filter(edge=>edge.sourceSlotId===slot.id||edge.targetSlotId===slot.id).length} semantic edges touch ${slot.id}.`));const relations=this.state.relations.filter(item=>item.sourceId===knowledge?.id||item.targetId===knowledge?.id);if(!relations.length)root.append(this.paragraph('No free Knowledge relations. Structure edges remain explicit in the selected template.'));for(const relation of relations)root.append(this.paragraph(`${relation.sourceId} ${relation.type} ${relation.targetId}`));if(instance)root.append(this.paragraph(`${instance.bindings.length} slot bindings · ${(materializeTemplate(template,instance.parameters).edges??[]).length} structure edges`))}
  inspectorRules(root,{instance,template}){root.append(this.heading('Rules & Parameters'));if(!instance||!template){root.append(this.paragraph('Select a Structure instance.'));return}for(const parameter of template.parameters??[]){const row=document.createElement('div');row.className='parameter-row';const label=document.createElement('label');label.textContent=parameter.label;const input=document.createElement(parameter.type==='enum'?'select':'input');if(parameter.type==='enum')for(const value of parameter.options){const option=document.createElement('option');option.value=option.textContent=value;input.append(option)}else input.type=parameter.type==='number'?'number':'text';input.value=instance.parameters[parameter.id]??parameter.defaultValue;input.addEventListener('change',async()=>{this.checkpoint();instance.parameters[parameter.id]=parameter.type==='number'?Number(input.value):input.value;runInstance(instance,materializeTemplate(template,instance.parameters));await put('structureInstances',instance);this.renderAll();this.saved()});row.append(label,input);root.append(row)}for(const rule of template.rules??[]){const card=document.createElement('div');card.className='rule-card';card.textContent=`${rule.target??rule.type}: ${JSON.stringify(rule.expression??rule.type)}`;root.append(card)}const results=instance.runtimeState?.results??{},errors=instance.runtimeState?.errors??{};root.append(this.paragraph(`Results: ${JSON.stringify(results)}`));for(const [key,message]of Object.entries(errors)){const error=this.paragraph(`${key}: ${message}`);error.className='runtime-error';root.append(error)}}
  inspectorNotes(root,{knowledge,instance}){root.append(this.heading('Notes'));if(!knowledge){root.append(this.paragraph('Standalone Structure notes can be attached after assigning an owner Knowledge.'));return}const field=this.field('Markdown / LaTeX',knowledge.content??'',async value=>{knowledge.content=value;knowledge.updatedAt=now();await put('knowledge',knowledge);this.saved()},{type:'textarea'});field.querySelector('textarea').addEventListener('input',()=>this.saving());root.append(field,this.paragraph('Markdown and LaTeX are stored as semantic content and auto-saved on change.'))}
  inspectorAppearance(root,{instance,template}){root.append(this.heading('Appearance'));if(!instance||!template){root.append(this.paragraph('Select a Structure instance.'));return}root.append(this.paragraph(`Layout: ${template.layout.type}`),this.paragraph('Presentation state (zoom, pan, offsets) is independent from semantic bindings.'),this.field('Zoom',`${Math.round(this.zoom*100)}%`,null,{readonly:true}));const focus=document.createElement('button');focus.textContent='Toggle Focus Mode';focus.addEventListener('click',()=>this.toggleFocus());root.append(focus)}

  openSearch(){this.renderSearchForm();$('#searchDialog').showModal()}
  renderSearchForm(){
    $$('.search-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.searchTab===this.activeSearchTab));const form=$('#searchForm');form.className='';form.replaceChildren();
    const makeInput=(placeholder,key)=>{const input=document.createElement('input');input.placeholder=placeholder;input.dataset.key=key;input.addEventListener('input',()=>this.runSearch(Object.fromEntries([...form.querySelectorAll('[data-key]')].map(node=>[node.dataset.key,node.value]))));return input};
    if(this.activeSearchTab==='text')form.append(makeInput('Search title, notes, relation or aliases…','query'));
    else if(this.activeSearchTab==='structure'){form.className='structure-query';form.append(makeInput('Template: LMN / Mod-12 / Hasse','templateId'),makeInput('Position: L2','slotId'),makeInput('Slot role: existence','role'),makeInput('Relation: precedes','relationType'),makeInput('Modular index: 5','modularIndex'))}
    else{form.className='pattern-query';form.append(makeInput('existence','sourceRole'),Object.assign(document.createElement('span'),{textContent:'→'}),makeInput('precedes','relationType'),Object.assign(document.createElement('span'),{textContent:'→'}),makeInput('essence','targetRole'));const select=document.createElement('select');select.dataset.key='direction';for(const value of['directed','undirected','bidirectional','cyclic'])select.append(Object.assign(document.createElement('option'),{value,textContent:value}));select.addEventListener('change',()=>this.runSearch(Object.fromEntries([...form.querySelectorAll('[data-key]')].map(node=>[node.dataset.key,node.value]))));form.append(select)}
    setTimeout(()=>form.querySelector('input')?.focus(),0);this.runSearch({})
  }
  runSearch(criteria={}){
    const clean=Object.fromEntries(Object.entries(criteria).filter(([,value])=>String(value??'').trim()!==''));let hits=[];if(this.activeSearchTab==='text')hits=textSearch(clean.query??'',this.state);else if(this.activeSearchTab==='structure')hits=structureSearch(clean,this.state);else hits=Object.keys(clean).length?patternSearch(clean,this.state):[];
    const root=$('#searchResults');root.replaceChildren();for(const hit of hits){const owner=this.state.knowledge.find(item=>item.id===hit.ownerKnowledgeId),row=document.createElement('button');row.className='search-result';row.textContent=hit.title??(owner?`${owner.title} · ${hit.template?.name??this.template(hit.templateId)?.name??'Structure match'}`:hit.template?.name)??`${hit.type} · ${hit.instanceId??hit.id}`;row.addEventListener('click',()=>{if(hit.type==='knowledge')this.selectKnowledge(hit.id);else this.selectInstance(hit.id??hit.instanceId);$('#searchDialog').close()});root.append(row)}if(!hits.length)root.append(this.paragraph(Object.keys(clean).length?'No semantic match.':'Build a semantic query above.'));
  }

  async saveCustomTemplate(){
    const count=Math.max(1,Math.min(30,Number($('#builderSlots').value)||1)),sourceRole=$('#builderSourceRole').value.trim()||'source',targetRole=$('#builderTargetRole').value.trim()||'target',relationType=$('#builderRelationType').value.trim(),slots=Array.from({length:count},(_,index)=>({id:`slot-${index+1}`,label:index===0?sourceRole:index===1?targetRole:`Slot ${index+1}`,role:index===0?sourceRole:index===1?targetRole:'custom',semanticCoordinate:{order:index},accepts:['knowledge','structure','value','variable'],cardinality:'one'})),edges=count>1&&relationType?[{id:'edge-1',sourceSlotId:'slot-1',targetSlotId:'slot-2',direction:$('#builderDirection').value,relationType,label:relationType}]:[],template={id:`custom:${uid()}`,name:$('#builderName').value.trim()||'Custom Structure',description:'User-defined semantic Structure Template',version:1,category:$('#builderCategory').value,builtin:false,nestable:true,computable:false,slots,edges,parameters:[],constraints:[],rules:[],layout:{type:$('#builderLayout').value},visual:{accent:'#596b63'}};
    this.checkpoint();this.state.structureTemplates.push(template);await put('structureTemplates',template);$('#builderDialog').close();this.openLibrary('insert');this.saved();
  }

  previewImport(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result),result=importV3Bundle(data,this.state);this.pendingImport=result.valid?result.state:null;const root=$('#importPreview');root.textContent=result.valid?`Valid V3 bundle · ${result.state.knowledge.length} Knowledge · ${result.state.structureInstances.length} Structure instances`:`Invalid bundle: ${result.errors.join('; ')}`;$('#importDialog').showModal()}catch(error){this.pendingImport=null;$('#importPreview').textContent=`Invalid JSON: ${error.message}`;$('#importDialog').showModal()}};reader.readAsText(file)}
  async confirmImport(){if(!this.pendingImport)return;this.checkpoint();this.state=this.pendingImport;await this.persistState();this.pendingImport=null;$('#importDialog').close();this.renderAll()}
  exportBundle(){const blob=new Blob([JSON.stringify(exportV3Bundle(this.state),null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`lmn-v3-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href)}

  setZoom(value){this.zoom=Math.max(.25,Math.min(2.5,Number(value.toFixed(2))));$('#zoomReset').textContent=`${Math.round(this.zoom*100)}%`;this.applyTransform();this.renderWorkspace()}
  applyTransform(){$('#canvasStage').style.transform=`translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`}
  fitView(){this.zoom=.85;this.pan={x:0,y:0};$('#zoomReset').textContent='85%';this.applyTransform();this.renderWorkspace()}
  toggleFocus(force){const shell=$('#appShell'),next=force??!shell.classList.contains('focus-mode');shell.classList.toggle('focus-mode',next)}
  togglePanel(name){if(innerWidth>1100){this.toggleFocus()}else{const panel=$(`#${name}`),open=panel.style.translate==='0px';panel.style.translate=open?'': '0px'}}
}

export async function bootstrapWorkspace(){const controller=new WorkspaceController();await controller.start();globalThis.lmnWorkspace=controller;return controller}
