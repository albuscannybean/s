import {VariableSchemeRepository} from '../structure-engine/variable-schemes.js';

const $=s=>document.querySelector(s);
const language=(app,zh,en)=>app.preferences.language==='en'?en:zh;
const button=(label,run)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=run;return b};
export function libraryDeletionPlan(state,selected=[]){
 const templateIds=new Set(selected.filter(x=>x.kind==='template').map(x=>x.id));
 const schemeIds=new Set(selected.filter(x=>x.kind==='scheme').map(x=>x.id));
 const templates=(state.structureTemplates??[]).filter(t=>templateIds.has(t.id)&&!t.builtin&&!t.hidden);
 const schemes=(state.variableSchemes??[]).filter(s=>schemeIds.has(s.id)&&!s.deleted&&!s.hidden);
 return{templates:templates.map(t=>t.id),schemes:schemes.map(s=>s.id),retained:templates.filter(t=>(state.structureInstances??[]).some(i=>i.templateId===t.id)).map(t=>t.id),count:templates.length+schemes.length};
}
export function applyLibraryDeletion(state,plan){
 const selected=new Set(plan.templates),inUse=new Set((state.structureInstances??[]).map(i=>i.templateId));
 state.structureTemplates=state.structureTemplates.flatMap(t=>!selected.has(t.id)?[t]:inUse.has(t.id)?[{...t,hidden:true,libraryDeleted:true}]:[]);
 const repository=new VariableSchemeRepository(state.variableSchemes);
 for(const id of plan.schemes)repository.remove(id);
 state.variableSchemes=repository.schemes;
 return state;
}
export function installStructureLibrary(Controller){
 const previous={renderLibrary:Controller.prototype.renderLibrary,renderNavigator:Controller.prototype.renderNavigator,openSchemeMenu:Controller.prototype.openSchemeMenu};
 Object.assign(Controller.prototype,{
  renderLibrary(){
   previous.renderLibrary.call(this);
   const tools=$('#structureLibrary .library-tools');
   tools.querySelector('.library-manage-button')?.remove();
   const manage=button(language(this,'管理 / 批量删除','Manage / delete'),()=>this.openLibraryManager());
   manage.className='library-manage-button';tools.append(manage);
  },
  renderNavigator(){
   previous.renderNavigator.call(this);
   if(this.navigatorMode!=='library')return;
   const manage=button(language(this,'管理自定义结构与变量方案','Manage templates and schemes'),()=>this.openLibraryManager());
   manage.className='nav-create-structure';$('#navigatorContent').prepend(manage);
  },
  openLibraryManager(){
   this.closeOpenDialogs();
   let dialog=$('#libraryManager');
   if(!dialog){dialog=document.createElement('dialog');dialog.id='libraryManager';dialog.className='sheet library-manager';document.body.append(dialog)}
   this.libraryManageSelection=new Map();dialog.replaceChildren();
   const header=document.createElement('header'),title=document.createElement('h2');
   title.textContent=language(this,'管理结构与变量方案','Manage templates and schemes');
   header.append(title,button('×',()=>dialog.close()));
   const tools=document.createElement('div');tools.className='library-manager-tools';
   const search=document.createElement('input');search.id='libraryManagerSearch';search.placeholder=language(this,'筛选名称','Filter by name');
   const filter=document.createElement('select');filter.id='libraryManagerType';
   for(const[value,zh,en]of[['all','全部','All'],['template','自定义结构','Custom templates'],['scheme','变量方案','Variable schemes']])filter.add(new Option(language(this,zh,en),value));
   this.libraryManageQuery='';this.libraryManageType='all';
   search.oninput=()=>{this.libraryManageQuery=search.value;this.renderLibraryManager()};
   filter.onchange=()=>{this.libraryManageType=filter.value;this.renderLibraryManager()};
   tools.append(search,filter,button(language(this,'选择当前结果','Select results'),()=>{for(const x of this.libraryManageVisible??[])this.libraryManageSelection.set(x.kind+':'+x.id,x);this.renderLibraryManager()}),button(language(this,'清空选择','Clear'),()=>{this.libraryManageSelection.clear();this.renderLibraryManager()}));
   const list=document.createElement('div');list.className='library-manager-list';
   const footer=document.createElement('footer'),count=document.createElement('span');count.id='libraryManagerCount';
   const remove=button(language(this,'删除所选…','Delete selected…'),()=>{const selected=[...this.libraryManageSelection.values()];dialog.close();this.confirmLibraryDeletion(selected)});
   remove.id='libraryManagerDelete';remove.className='danger';
   footer.append(count,button(language(this,'取消','Cancel'),()=>dialog.close()),remove);dialog.append(header,tools,list,footer);
   this.renderLibraryManager();dialog.showModal();
  },
  renderLibraryManager(){
   const all=[...this.state.structureTemplates.filter(t=>!t.builtin&&!t.hidden).map(t=>({kind:'template',id:t.id,title:t.name})),...this.state.variableSchemes.filter(s=>!s.deleted&&!s.hidden).map(s=>({kind:'scheme',id:s.id,title:s.title??s.name}))];
   this.libraryManageVisible=all.filter(x=>(this.libraryManageType==='all'||x.kind===this.libraryManageType)&&x.title.toLocaleLowerCase().includes(this.libraryManageQuery.toLocaleLowerCase()));
   const list=$('#libraryManager .library-manager-list');list.replaceChildren();
   for(const item of this.libraryManageVisible){
    const row=document.createElement('label');row.className='library-manager-row';
    const check=document.createElement('input');check.type='checkbox';check.dataset.libraryKind=item.kind;check.dataset.libraryId=item.id;check.checked=this.libraryManageSelection.has(item.kind+':'+item.id);
    check.onchange=()=>{check.checked?this.libraryManageSelection.set(item.kind+':'+item.id,item):this.libraryManageSelection.delete(item.kind+':'+item.id);this.renderLibraryManager()};
    const name=document.createElement('span');name.textContent=item.title;
    const kind=document.createElement('small');kind.textContent=item.kind==='template'?language(this,'自定义结构','Template'):language(this,'变量方案','Scheme');
    row.append(check,name,kind);list.append(row);
   }
   if(!list.children.length){const p=document.createElement('p');p.textContent=language(this,'没有匹配的自定义结构或变量方案。','No matching custom templates or schemes.');list.append(p)}
   const count=this.libraryManageSelection.size;$('#libraryManagerCount').textContent=language(this,'已选择 '+count+' 项',count+' selected');$('#libraryManagerDelete').disabled=!count;
  },
  confirmLibraryDeletion(selected){
   const plan=libraryDeletionPlan(this.state,selected);if(!plan.count)return;
   this.closeOpenDialogs();
   this.showDangerDialog(language(this,'确认删除库项目？','Delete library items?'),
    language(this,'<p>删除 '+plan.templates.length+' 个自定义结构模板和 '+plan.schemes.length+' 个变量方案。</p><p>已有内容保留原样；使用中的模板定义会随实例保留。删除后可在弹出的通知中撤回。</p>','<p>Delete '+plan.templates.length+' custom templates and '+plan.schemes.length+' variable schemes.</p><p>Existing content is preserved, including definitions used by instances. Use Undo in the notification to restore these library items.</p>'),
    language(this,'删除','Delete'),()=>{
     this.commit('library:delete',()=>applyLibraryDeletion(this.state,plan));
     this.showUndoBanner('library:delete');
     $('#undoBannerText').textContent=language(this,'已删除 '+plan.count+' 个库项目',plan.count+' library items deleted');
     $('#undoBanner').setAttribute('role','alert');
    });
  },
  deleteUserTemplate(id){this.confirmLibraryDeletion([{kind:'template',id}])},
  openSchemeMenu(id,event){
   const original=this.showContextMenu;
   this.showContextMenu=(x,y,items)=>original.call(this,x,y,items.map(item=>item.danger?{...item,action:()=>this.confirmLibraryDeletion([{kind:'scheme',id}])}:item));
   try{return previous.openSchemeMenu.call(this,id,event)}finally{this.showContextMenu=original}
  }
 });
}

