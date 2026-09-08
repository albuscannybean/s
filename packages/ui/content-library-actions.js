import {listContentEntries,listContentDestinations,prepareContentOperation} from '../navigation/content-operations.js';
import {createDocumentEditor} from './document-editor.js';
import {createStructureInstance} from '../structure-engine/model.js';
const $=id=>document.querySelector(id);
const uid=()=>crypto.randomUUID();
const text=(host,zh,en)=>host.preferences.language==='en'?en:zh;
const element=(tag,className,content)=>{const e=document.createElement(tag);if(className)e.className=className;if(content!=null)e.textContent=content;return e;};
const action=(label,callback,className)=>{const b=element('button',className,label);b.type='button';b.onclick=callback;return b;};
const pathLabel=entry=>(entry.path??[]).map(p=>p.label).join(' › ')||entry.label;
const targetKey=target=>JSON.stringify(target);
const MIME='application/x-lmn-content-targets';
const kinds={knowledge:['知识','Knowledge'],structure:['结构','Structure'],content:['正文 / 图片','Content / images'],note:['附属正文','Attached text'],board:['画板','Board'],relation:['关系','Relation']};

export function installContentLibrary(Controller){
 const prior={validOpenTab:Controller.prototype.validOpenTab,renderNavigator:Controller.prototype.renderNavigator,renderNavigatorObject:Controller.prototype.renderNavigatorObject,keydown:Controller.prototype.keydown,insertTemplate:Controller.prototype.insertTemplate,openLibrary:Controller.prototype.openLibrary,closeTransientOverlays:Controller.prototype.closeTransientOverlays};
 Object.assign(Controller.prototype,{
  clearStandaloneStructureInsert(){this.standaloneStructureInsert=false;this._standaloneStructureSession=null;},
  openLibrary(nested=false){this.clearStandaloneStructureInsert();return prior.openLibrary.call(this,nested);},
  closeTransientOverlays(...args){this.clearStandaloneStructureInsert();return prior.closeTransientOverlays.apply(this,args);},
  openStandaloneStructureLibrary(){
   const session={};this._standaloneStructureSession=session;this.standaloneStructureInsert=true;
   const dialogs=['#structureLibrary','#structureConfigDialog','#quickBuilderDialog','#advancedBuilderDialog'].map($).filter(Boolean);
   for(const dialog of dialogs)if(!dialog.dataset.contentLibraryLifecycle){
    dialog.dataset.contentLibraryLifecycle='true';
    dialog.addEventListener('close',()=>{const active=this._standaloneStructureSession;queueMicrotask(()=>{if(active&&active===this._standaloneStructureSession&&!dialogs.some(item=>item.open))this.clearStandaloneStructureInsert();});});
   }
   return prior.openLibrary.call(this,false);
  },
  validOpenTab(tab){
   if(!prior.validOpenTab.call(this,tab))return false;
   const route=this.documentRoute(tab.id);if(!route.valid)return true;
   const [instanceId,slotId,id]=route.parts;
   if(route.kind==='container')return!!this.navigationIndex().find({kind:'slot',id:slotId,instanceId});
   if(route.kind.startsWith('content')&&route.kind!=='content-draft')return!!this.navigationIndex().find({kind:'content',id,slotId,instanceId});
   if(route.kind.startsWith('relation'))return!!this.navigationIndex().find({kind:'relation',id:slotId,instanceId});
   return true;
  },
  contentEntries(){return this._contentRenderEntries??listContentEntries(this.state,{language:this.preferences.language});},
  contentEntry(target){if(target?.key&&this._contentRenderByKey?.has(target.key))return this._contentRenderByKey.get(target.key);return this.contentEntries().find(e=>e.key===target?.key||targetKey(e.target)===targetKey(target?.target??target))??this.contentEntries().find(e=>e.key===this.navigationIndex().find(target)?.key);},
  contentSelectionTargets(fallback=null){
   const keys=this.contentSelection??new Set(),all=this.contentEntries();
   if(fallback&&!keys.has(fallback.key))return[fallback.target??this.contentEntry(fallback)?.target].filter(Boolean);
   return all.filter(e=>keys.has(e.key)).map(e=>e.target);
  },
  renderNavigator(){
   if(this.navigatorMode!=='outline'&&this.navigatorMode!=='knowledge')return prior.renderNavigator.call(this);
   this._renderingNavigator=true;this._contentRenderEntries=listContentEntries(this.state,{language:this.preferences.language,index:this.navigationIndex()});this._contentRenderByKey=new Map(this._contentRenderEntries.map(e=>[e.key,e]));prior.renderNavigator.call(this);if(this.navigatorMode!=='outline'){this._contentRenderEntries=null;this._contentRenderByKey=null;this._renderingNavigator=false;if(!this._renderingAll)this._renderIndex=null;return;}
   const root=$('#navigatorContent'),entries=this.contentEntries(),byKey=new Map(entries.map(e=>[e.key,e]));
   this.contentSelection??=new Set();for(const key of this.contentSelection)if(!byKey.has(key))this.contentSelection.delete(key);
   const bar=element('div','content-library-tools');
   bar.append(action(text(this,'＋ 正文','＋ Note'),()=>this.createStandaloneContent()),action(text(this,'＋ 结构','＋ Structure'),()=>this.openStandaloneStructureLibrary()),action(text(this,'多选','Select'),()=>{this.contentSelectionMode=!this.contentSelectionMode;this.renderNavigator()}));
   if(this.contentSelectionMode){bar.append(action(text(this,'移动…','Move…'),()=>this.openContentAddress(this.contentSelectionTargets())),action(text(this,'删除…','Delete…'),()=>this.confirmContentDelete(this.contentSelectionTargets()),'danger'));}
   const rootTarget=action(text(this,'内容库根目录','Library root'),()=>this.activateHome(),'content-root-target');rootTarget.title=text(this,'可拖放内容到这里，解除当前归类','Drop content here to remove its current classification');
   this.installContentEntryDrop(rootTarget,{kind:'root'});bar.append(rootTarget);root.prepend(bar);
   for(const row of root.querySelectorAll('[data-object-key]')){
    const entry=byKey.get(row.dataset.objectKey);if(!entry||row.classList.contains('reference'))continue;
    row.classList.toggle('content-selected',this.contentSelection.has(entry.key));
    row.setAttribute('aria-selected',String(this.contentSelection.has(entry.key)));
    row.oncontextmenu=event=>{event.preventDefault();this.openNavigatorEntryMenu(entry,event)};
    if(this.contentSelectionMode&&entry.capabilities.delete){
     const box=element('input','content-select');box.type='checkbox';box.checked=this.contentSelection.has(entry.key);box.setAttribute('aria-label',text(this,'选择 ','Select ')+entry.label);
     box.onclick=event=>event.stopPropagation();box.onchange=()=>{box.checked?this.contentSelection.add(entry.key):this.contentSelection.delete(entry.key);this.renderNavigator()};row.prepend(box);
    }
    row.addEventListener('click',event=>{
     if(!(event.ctrlKey||event.metaKey||event.shiftKey)||event.target.closest('.nav-location-menu'))return;
     if(!Object.values(entry.capabilities).some(Boolean))return;
     event.preventDefault();event.stopImmediatePropagation();this.contentSelection.has(entry.key)?this.contentSelection.delete(entry.key):this.contentSelection.add(entry.key);this.contentSelectionMode=true;this.renderNavigator();
    },true);
   }
   this._contentRenderEntries=null;this._contentRenderByKey=null;this._renderingNavigator=false;if(!this._renderingAll)this._renderIndex=null;
  },
  openNavigatorMenu(event){
   const r=event.currentTarget.getBoundingClientRect();this.showContextMenu(r.right-240,r.bottom+5,[
    {icon:'＋',label:text(this,'新建未归类正文','New unassigned note'),action:()=>this.createStandaloneContent()},
    {icon:'＋',label:text(this,'新建未归类结构','New unassigned structure'),action:()=>this.openStandaloneStructureLibrary()},
    {icon:'☑',label:text(this,'批量管理 / 删除内容…','Manage / delete content…'),action:()=>this.openBatchDelete()},
    {icon:'▣',label:text(this,'粘贴到根目录','Paste at library root'),disabled:!this.contentClipboard,action:()=>this.pasteContent({kind:'root'})},
    {separator:true},{icon:'−',label:text(this,'全部折叠','Collapse all'),action:()=>this.collapseNavigatorAll()},
    {icon:'↳',label:text(this,'展开当前路径','Expand current path'),action:()=>this.expandCurrentPath()}
   ]);
  },
  openNavigatorEntryMenu(raw,event){
   const entry=this.contentEntry(raw);if(!entry)return;
   const targets=this.contentSelectionTargets(entry),entries=targets.map(t=>this.contentEntry(t)).filter(Boolean),single=entries.length===1,items=[];
   items.push({icon:'↗',label:text(this,'打开','Open'),action:()=>this.openSearchResult(entry.target)});
   if(single&&['knowledge','structure','content','board'].includes(entry.kind))items.push({icon:'✎',label:text(this,'重命名','Rename'),action:()=>this.renameContent(entry.target)});
   if(entries.every(e=>e.capabilities.move))items.push({icon:'↪',label:text(this,'更改内容地址…','Change content address…'),action:()=>this.openContentAddress(targets)},{icon:'✂',label:text(this,'剪切','Cut'),action:()=>this.setContentClipboard('move',targets)});
   if(entries.every(e=>e.capabilities.copy))items.push({icon:'⧉',label:text(this,'复制','Copy'),action:()=>this.setContentClipboard('copy',targets)});
   if(['knowledge','slot'].includes(entry.kind))items.push({icon:'▣',label:text(this,'粘贴到这里','Paste here'),disabled:!this.contentClipboard,action:()=>this.pasteContent(entry.target)});
   if(entry.kind==='structure')items.push({icon:'⚙',label:text(this,'结构设置与操作','Structure settings and tools'),action:()=>{this.openInstance(entry.id);this.openPanel('structure',entry.id,'settings')}},{icon:'⌘',label:text(this,'结构源码','Structure source'),action:()=>{this.openInstance(entry.id);this.openStructureSource(entry.id)}});
   if(entry.kind==='structure')items.push({icon:'⋯',label:text(this,'更多结构操作…','More structure actions…'),action:()=>this.openStructureMenu(entry.id,event)});
   if(entry.kind==='slot')items.push({icon:'＋',label:text(this,'节点设置与添加内容','Node tools and content'),action:()=>{this.openInstance(entry.instanceId);this.openPanel('slot',entry.id,'info')}});
   if(single&&entry.kind==='knowledge')items.push({icon:'↧',label:text(this,'导出','Export'),action:()=>{this.openKnowledge(entry.id);this.exportAs('markdown')}});
   if(entries.every(e=>e.capabilities.delete))items.push({separator:true},{icon:'⌫',label:text(this,'删除所选内容…','Delete selected content…'),danger:true,action:()=>this.confirmContentDelete(targets)});
   const rect=event.currentTarget?.getBoundingClientRect?.();this.showContextMenu(event.clientX??rect?.left??100,event.clientY??rect?.bottom??100,items);
  },
  renameContent(target){
   const entry=this.contentEntry(target);if(!entry)return;
   if(entry.kind==='knowledge')return this.renameKnowledge(entry.id);
   if(entry.kind==='structure')return this.renameStructureInstance(entry.id);
   this.requestText(text(this,'重命名内容','Rename content'),entry.label,value=>{
    this.commit('content:rename',()=>{
     const current=this.contentEntry(target);if(!current)return;const r=current.record;
     if(current.kind==='content'&&current.instanceId){r.content??={};r.content.title=value;r.localDisplayTitle=value;}
     else{r.title=value;if(r.objectContent)r.objectContent.title=value;if(r.content&&typeof r.content==='object')r.content.title=value;}
    });
   },{label:text(this,'名称','Name')});
  },
  setContentClipboard(operation,targets){
   if(!targets?.length)return false;
   const entries=targets.map(target=>this.contentEntry(target));
   if(!['move','copy'].includes(operation)||entries.some(entry=>!entry?.capabilities[operation])){
    this.contentOperationError(text(this,'所选内容不支持此操作，请使用对应结构的专用编辑工具。','The selection does not support this operation. Use its structure’s dedicated editing tools.'));return false;
   }
   this.contentClipboard={operation,targets:entries.map(entry=>structuredClone(entry.target))};
   $('#saveStatus').textContent=text(this,operation==='move'?'已剪切，选择目标位置后粘贴':'已复制，选择目标位置后粘贴',operation==='move'?'Cut. Choose a destination and paste.':'Copied. Choose a destination and paste.');
   return true;
  },
  pasteContent(destination){
   const c=this.contentClipboard;if(!c)return;
   if(this.performContentOperation(c.operation,c.targets,destination)&&c.operation==='move')this.contentClipboard=null;
  },
  performContentOperation(operation,targets,destination){
   try{
    const result=prepareContentOperation(this.state,{operation,targets,destination,language:this.preferences.language});
    const previous=this.currentNavigatorTarget(),remainingPath=structuredClone(this.path??[]);
    this.commit('content:'+operation,()=>{
     this.state=result.state;this.contentSelection=new Set();this.navigatorPathSignature=null;this.selection.clear();this.closePanel();
     const index=this.navigationIndex();this.reconcileContentTabs(index);const current=previous?index.find(previous):null;
     if(!current){this.currentKnowledgeId=null;this.currentInstanceId=null;this.currentBoardId=null;this.document='welcome';this.path=[];}
     else{this.path=index.pathFor(current)??[];this.currentKnowledgeId=[...this.path].reverse().find(s=>s.kind==='knowledge')?.id??null;}
     this.fitPending=true;
    });
    if(operation!=='delete'&&result.targets[0])this.openSearchResult(result.targets[0]);
    else if(this.document==='welcome'){const index=this.navigationIndex(),fallback=[...remainingPath].reverse().map(p=>index.find(p)).find(Boolean);if(fallback)this.openSearchResult(fallback);}
    $('#saveStatus').textContent=text(this,'操作完成，可撤销','Completed. Undo is available.')+(result.warnings.length?' · '+result.warnings.join(' '):'');
    return result;
   }catch(error){this.contentOperationError(error.message);return false;}
  },
  contentOperationError(message){
   const old=$('#contentOperationNotice');old?.remove();const box=element('div','content-operation-notice');box.id='contentOperationNotice';box.setAttribute('role','alert');
   box.append(element('span','',message),action('×',()=>box.remove()));$('#navigator').append(box);
   $('#saveStatus').textContent=message;
  },
  reconcileContentTabs(index=this.navigationIndex()){
   const entryFor=(documentId,knowledgeId,detail)=>{
    if(documentId==='notes')return index.find({kind:'knowledge',id:knowledgeId});
    if(documentId?.startsWith('navigator-object:'))return index.find(detail??decodeURIComponent(documentId.slice(17)));
    const route=this.documentRoute(documentId);if(!route.valid)return null;const [instanceId,slotId,id]=route.parts;
    if(route.kind==='structure'||route.kind==='source')return index.find({kind:'structure',id:instanceId});
    if(route.kind==='container')return index.find({kind:'slot',id:slotId,instanceId});
    if(route.kind.startsWith('content'))return index.find({kind:'content',id,slotId,instanceId});
    if(route.kind.startsWith('relation'))return index.find({kind:'relation',id:slotId,instanceId});
    return null;
   };
   const updateLocation=location=>{
    const entry=entryFor(location.document,location.knowledgeId,location.navigatorDetailTarget);if(!entry)return null;
    const path=index.pathFor(entry),knowledgeId=[...path].reverse().find(item=>item.kind==='knowledge')?.id??null;
    return {...location,knowledgeId,instanceId:entry.instanceId??(entry.kind==='structure'?entry.id:null),path};
   };
   const unique=new Map();let activeKey=null;
   for(const tab of this.openTabs){
    const entry=entryFor(tab.id,tab.knowledgeId),wasActive=tab.key===this.activeTabKey;
    if(!entry){if(tab.id.startsWith('new-tab')&&(!tab.knowledgeId||this.state.knowledge.some(item=>item.id===tab.knowledgeId))){unique.set(tab.key,tab);if(wasActive)activeKey=tab.key;}continue;}
    const path=index.pathFor(entry);tab.knowledgeId=[...path].reverse().find(item=>item.kind==='knowledge')?.id??null;tab.key=(tab.knowledgeId??'global')+'::'+tab.id;
    const current=tab.history?.[tab.historyIndex],mapped=(tab.history??[]).map(location=>({original:location,next:updateLocation(location)})).filter(item=>item.next);
    tab.history=mapped.map(item=>item.next);tab.historyIndex=Math.max(0,mapped.findIndex(item=>item.original===current));
    if(tab.location)tab.location=updateLocation(tab.location);
    if(!unique.has(tab.key)||wasActive)unique.set(tab.key,tab);if(wasActive)activeKey=tab.key;
   }
   this.openTabs=[...unique.values()];this.activeTabKey=activeKey;this.openDocuments=new Map();
   for(const tab of this.openTabs){const owner=tab.knowledgeId??'global';if(!this.openDocuments.has(owner))this.openDocuments.set(owner,new Set());this.openDocuments.get(owner).add(tab.id);}
  },
  openContentAddress(targets,operation='move'){
   if(!targets?.length)return;
   if(targets.some(target=>!this.contentEntry(target)?.capabilities[operation])){this.contentOperationError(text(this,'所选内容不支持更改地址或复制。','The selection cannot be moved or copied.'));return;}
   let choices;try{choices=listContentDestinations(this.state,{targets,operation,language:this.preferences.language})}catch(error){this.contentOperationError(error.message);return}
   $('#contentAddressDialog')?.remove();const dialog=element('dialog','content-address-dialog');dialog.id='contentAddressDialog';
   const header=element('header'),heading=element('h2','',operation==='copy'?text(this,'复制内容到','Copy content to'):text(this,'更改内容地址','Change content address'));header.append(heading,action('×',()=>dialog.close()));
   const search=element('input','content-address-search');search.type='search';search.placeholder=text(this,'搜索目标名称或完整路径','Search destination name or full path');search.setAttribute('aria-label',search.placeholder);
   const current=element('p','content-address-current',targets.map(t=>{const e=this.contentEntry(t);return e?pathLabel(e):''}).join('\n'));
   const list=element('div','content-address-list'),status=element('p','content-address-status'),footer=element('footer'),confirm=action(operation==='copy'?text(this,'复制到此处','Copy here'):text(this,'移动到此处','Move here'),()=>{
    if(selected&&this.performContentOperation(operation,targets,selected.target)){if(operation==='move'&&this.contentClipboard?.operation==='move')this.contentClipboard=null;dialog.close();}
   });confirm.disabled=true;let selected=null;
   const render=()=>{
    list.replaceChildren();const q=search.value.trim().toLowerCase();
    for(const choice of choices.filter(c=>(c.label+' '+pathLabel(c)).toLowerCase().includes(q))){
     const button=action('',()=>{selected=choice;for(const b of list.children)b.classList.toggle('selected',b===button);status.textContent=pathLabel(choice);confirm.disabled=false;});
     button.dataset.destinationKey=choice.key;button.className='content-address-option';button.append(element('b','',choice.label),element('small','',pathLabel(choice)));list.append(button);
    }
    if(!list.children.length)list.append(element('p','',text(this,'没有匹配地址','No matching address')));
   };
   search.oninput=render;footer.append(action(text(this,'取消','Cancel'),()=>dialog.close()),confirm);dialog.append(header,current,search,list,status,footer);document.body.append(dialog);render();dialog.showModal();search.focus();
  },
  installNavigatorEntryDrag(row,raw){
   const entry=this.contentEntry(raw);if(!entry?.capabilities.move)return;
   row.draggable=true;row.ondragstart=event=>{event.stopPropagation();const targets=this.contentSelectionTargets(entry);event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData(MIME,JSON.stringify(targets));};
  },
  installContentEntryDrop(row,entry){
   if(!['root','knowledge','slot'].includes(entry.kind))return;
   row.ondragover=event=>{if(!event.dataTransfer.types.includes(MIME))return;event.preventDefault();event.stopPropagation();row.classList.add('drag-over');event.dataTransfer.dropEffect=event.ctrlKey||event.metaKey?'copy':'move';};
   row.ondragleave=()=>row.classList.remove('drag-over');
   row.ondrop=event=>{
    const raw=event.dataTransfer.getData(MIME);if(!raw)return;event.preventDefault();event.stopPropagation();row.classList.remove('drag-over');
    try{const targets=JSON.parse(raw);if(!Array.isArray(targets)||targets.length>10000)throw new Error(text(this,'无效的拖放内容','Invalid drag data'));this.performContentOperation(event.ctrlKey||event.metaKey?'copy':'move',targets,entry.target??entry);}
    catch(error){this.contentOperationError(error.message);}
   };
  },
  openBatchDelete(){
   const dialog=$('#batchDeleteDialog');this.closeOpenDialogs(dialog);this.batchDeleteSelection=new Set();this.batchContentEntries=this.contentEntries().filter(e=>e.capabilities.delete);
   $('#batchDeleteSearch').value='';let filter=$('#batchContentType');
   if(!filter){filter=element('select');filter.id='batchContentType';$('#batchDeleteSearch').after(filter);}
   filter.replaceChildren(new Option(text(this,'全部内容类型','All content types'),''));
   for(const[kind,labels]of Object.entries(kinds))filter.append(new Option(text(this,...labels),kind));
   filter.append(new Option(text(this,'仅未归属内容','Unassigned only'),'unassigned'));filter.onchange=()=>this.renderBatchDelete();
   this.renderBatchDelete();dialog.showModal();$('#batchDeleteSearch').focus();
  },
  renderBatchDelete(){
   const root=$('#batchDeleteList'),q=$('#batchDeleteSearch').value.trim().toLowerCase(),filter=$('#batchContentType')?.value??'';
   this.batchContentEntries=this.contentEntries().filter(e=>e.capabilities.delete);
   const items=this.batchContentEntries.filter(e=>(!filter||filter==='unassigned'?filter!=='unassigned'||e.unassigned:e.kind===filter)&&(!q||(e.label+' '+pathLabel(e)).toLowerCase().includes(q)));
   const keys=new Set(this.batchContentEntries.map(e=>e.key));for(const key of this.batchDeleteSelection)if(!keys.has(key))this.batchDeleteSelection.delete(key);
   this.batchDeleteVisible=items.map(e=>e.key);root.replaceChildren();
   for(const entry of items){
    const row=element('label','batch-delete-row'),box=element('input'),label=element('span'),kind=element('em','',text(this,...(kinds[entry.kind]??[entry.kind,entry.kind])));
    box.type='checkbox';box.checked=this.batchDeleteSelection.has(entry.key);box.onchange=()=>{box.checked?this.batchDeleteSelection.add(entry.key):this.batchDeleteSelection.delete(entry.key);this.renderBatchDelete()};
    label.append(element('b','',entry.label),element('small','',pathLabel(entry)));row.append(box,label,kind);root.append(row);
   }
   if(!items.length)root.append(element('p','batch-delete-empty',text(this,'没有符合条件的内容','No matching content')));
   $('#batchDeleteSummary').textContent=text(this,'已选择 ','Selected ')+this.batchDeleteSelection.size+text(this,' 项；删除前将显示影响范围。',' items. Review their impact before deletion.');
   $('#batchDeletePreview').disabled=!this.batchDeleteSelection.size;
  },
  previewBatchDelete(){
   const targets=(this.batchContentEntries??[]).filter(e=>this.batchDeleteSelection.has(e.key)).map(e=>e.target);
   if(!targets.length)return;$('#batchDeleteDialog').close();this.confirmContentDelete(targets);
  },
  confirmContentDelete(targets){
   if(!targets?.length)return;
   try{
    const preview=prepareContentOperation(this.state,{operation:'delete',targets,language:this.preferences.language}),counts=preview.summary.counts,body=document.createElement('div');
    body.append(element('p','',text(this,'将删除所选内容及其直接拥有的内容；引用到的外部对象会保留。操作可撤销。','Delete the selected content and content it owns. Externally referenced objects are retained. Undo is available.')));
    const list=element('ul');for(const[key,names]of Object.entries({knowledge:['知识','Knowledge'],structures:['结构','Structures'],content:['正文','Content'],boards:['画板','Boards'],relations:['关系','Relations']}))if(counts[key])list.append(element('li','',text(this,...names)+': '+counts[key]));
    body.append(list);for(const warning of preview.warnings)body.append(element('p','',warning));
    this.showDangerDialog(text(this,'删除内容？','Delete content?'),body.innerHTML,text(this,'删除','Delete'),()=>this.performContentOperation('delete',targets));
   }catch(error){this.contentOperationError(error.message);}
  },
  createStandaloneContent(){
   const id=uid();this.commit('content:create',()=>{this.state.contentObjects??=[];this.state.contentObjects.push({id,title:text(this,'未命名正文','Untitled note'),contentType:'note',body:'',summary:'',tags:[],sources:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})});
   this.openSearchResult({kind:'content',id,contentScope:'global'});
  },
  insertTemplate(templateId,nested=false,parameters={}){
   const standalone=!nested&&(this.standaloneStructureInsert||!this.knowledge);this.clearStandaloneStructureInsert();
   if(!standalone)return prior.insertTemplate.call(this,templateId,nested,parameters);
   const template=this.state.structureTemplates.find(t=>t.id===templateId);if(!template)return;
   let instance;this.commit('structure:insert',()=>{instance=createStructureInstance(template,null,parameters);this.state.structureInstances.push(instance);this.currentKnowledgeId=null;});
   this.standaloneStructureInsert=false;this.openInstance(instance.id);return instance;
  },
  renderNavigatorObject(){
   const entry=this.navigationIndex().find(this.navigatorDetailTarget);
   if(entry?.kind!=='content'||entry.contentScope!=='global')return prior.renderNavigatorObject.call(this);
   const root=$('#contentDocumentContent'),record=entry.record,content=typeof record.content==='object'?record.content:record.objectContent??record;
   const value={...content,title:content.title??record.title??entry.label,body:typeof record.content==='string'?record.content:content.body??'',displayFormula:content.displayFormula??content.latex??''};
   let captured=false;root.replaceChildren(createDocumentEditor(document,{content:value,mode:this.globalContentMode??'edit',language:this.preferences.language,contextLabel:pathLabel(entry),
    onModeChange:mode=>{this.globalContentMode=mode;this.renderNavigatorObject()},
    onChange:next=>{
     if(!captured){this.undoStack.push(this.snapshot());this.redoStack=[];captured=true;}
     const live=this.state.contentObjects.find(c=>c.id===entry.id);if(!live)return;
     if(live.objectContent)live.objectContent={...live.objectContent,...next};else if(live.content&&typeof live.content==='object')live.content={...live.content,...next};else Object.assign(live,next);
     live.title=next.title;live.body=next.body;live.summary=next.summary;live.tags=next.tags;live.sources=next.sources;live.links=next.links;if('latex' in live)live.latex=next.displayFormula??'';if(typeof live.content==='string')live.content=next.body;live.updatedAt=new Date().toISOString();this.scheduleSave('content:edit');this.renderNavigator();this.renderBrowserTabs();
    },onDone:()=>this.activateHome(),onMore:event=>this.openNavigatorEntryMenu(entry,event??{clientX:400,clientY:140})
   }));
  },
  keydown(event){
   const row=event.target.closest?.('#navigatorContent [data-object-key]'),typing=event.target.closest?.('input,textarea,[contenteditable=true]'),key=event.key.toLowerCase();
   if(row&&!typing){
    const entry=this.contentEntries().find(e=>e.key===row.dataset.objectKey),targets=this.contentSelectionTargets(entry);
    if((event.ctrlKey||event.metaKey)&&['a','x','c','v'].includes(key)){
     event.preventDefault();if(key==='a'){this.contentSelectionMode=true;this.contentSelection=new Set(this.contentEntries().filter(e=>e.capabilities.move&&e.capabilities.copy&&e.capabilities.delete&&[...$('#navigatorContent').querySelectorAll('[data-object-key]')].some(row=>row.dataset.objectKey===e.key)).map(e=>e.key));this.renderNavigator();}
     else if(key==='v'){if(['knowledge','slot'].includes(entry?.kind))this.pasteContent(entry.target);else if(this.contentClipboard)this.openContentAddress(this.contentClipboard.targets,this.contentClipboard.operation);}
     else if(targets.length)this.setContentClipboard(key==='x'?'move':'copy',targets);return;
    }
    if(key==='delete'){event.preventDefault();this.confirmContentDelete(targets);return;}
    if(key==='f2'){event.preventDefault();if(entry)this.renameContent(entry.target);return;}
    if(event.altKey&&key==='m'){event.preventDefault();this.openContentAddress(targets);return;}
   }
   return prior.keydown.call(this,event);
  }
 });
}

