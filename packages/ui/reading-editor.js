import {renderStudyMarkdown} from './math-markup.js';

const fence=String.fromCharCode(96).repeat(3);
const tools={
  formula:{label:'公式',text:'$x^2$'},
  plot:{label:'函数图',text:fence+'plot\ny=sin(x)\n'+fence},
  matrix:{label:'矩阵结构',text:fence+'structure\nbuiltin:matrix-grid\n'+fence},
  graph:{label:'中心关系结构',text:fence+'structure\nbuiltin:n-center\n'+fence}
};

function element(parent,tag,text='',className=''){
  const node=parent.ownerDocument.createElement(tag);
  if(text)node.textContent=text;
  if(className)node.className=className;
  parent.append(node);
  return node;
}
function button(parent,label,action){
  const node=element(parent,'button',label);
  node.type='button';node.onclick=action;
  return node;
}
function mountTools(root,insert){
  const box=element(root,'details','','reading-toolbox');
  element(box,'summary','插入');
  const menu=element(box,'div','','reading-tool-options');
  for(const [id,tool] of Object.entries(tools)){
    button(menu,tool.label,()=>{insert(id);box.open=false;});
  }
  return box;
}

export function mountReadingEditor(root,{text='',label='笔记',mode='edit',onChange,limit=100000,placeholder='输入 Markdown、LaTeX 或插入结构'}){
  const bar=element(root,'div','','reading-editor-bar');
  const controls=element(bar,'div','','reading-editor-modes');
  const shell=element(root,'div','','reading-editor-shell');
  const input=element(shell,'textarea','','reading-source-editor');
  input.value=text;input.maxLength=limit;input.placeholder=placeholder;input.setAttribute('aria-label',label);
  const preview=element(shell,'div','','math-reading-body reading-preview');
  let currentMode=mode,pending;
  const options=[['read','阅读'],['edit','源码'],['split','分屏']];
  const modes=options.map(([id,name])=>[id,button(controls,name,()=>show(id))]);
  const toolbox=mountTools(bar,id=>{
    if(currentMode==='read')show('split');
    const tool=tools[id],selected=input.value.slice(input.selectionStart,input.selectionEnd);
    const value=id==='formula'&&selected?'$'+selected+'$':tool.text;
    const insert='\n'+value+'\n';
    if(input.value.length-selected.length+insert.length>limit)return;
    input.setRangeText(insert,input.selectionStart,input.selectionEnd,'end');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
  });
  function updatePreview(){
    if(currentMode!=='edit')renderStudyMarkdown(preview,input.value||'尚未写下笔记。');
  }
  function show(next){
    clearTimeout(pending);
    currentMode=next;
    shell.classList.toggle('reading-split',next==='split');
    input.hidden=next==='read';preview.hidden=next==='edit';
    for(const [id,control] of modes)control.setAttribute('aria-pressed',String(id===next));
    updatePreview();
  }
  input.addEventListener('input',()=>{
    onChange(input.value);
    clearTimeout(pending);
    pending=setTimeout(updatePreview,170);
  });
  show(mode);
  return {input,preview,show,toolbox};
}

const excerptText=block=>[...block.children].map(child=>child.innerText).join(' ').trim()||block.innerText.trim();
function blockAnchor(text,index){
  let hash=2166136261;
  for(const char of text)hash=Math.imul(hash^char.codePointAt(0),16777619);
  return (hash>>>0).toString(36)+'-'+index;
}

export function mountParagraphNotes(body,{readNotes,saveNotes}){
  const documentRef=body.ownerDocument;
  const savedNotes=readNotes();
  const blocks=[...body.children].filter(node=>node.matches('p,blockquote,ol,ul,.study-block,.math-display'));
  const occurrences=new Map(),matched=new Set();
  blocks.forEach((block,index)=>{
    if(block.querySelector('.document-plot'))return;
    const excerpt=excerptText(block);
    const occurrence=occurrences.get(excerpt)??0;
    occurrences.set(excerpt,occurrence+1);
    const anchor=blockAnchor(excerpt,occurrence);
    matched.add(anchor);
    const current=savedNotes.find(note=>note.anchor===anchor);
    const wrap=documentRef.createElement('div');wrap.className='reading-paragraph';
    block.before(wrap);wrap.append(block);
    const marker=button(wrap,current?.text?'批注':'＋',()=>openNote());
    marker.className='reading-paragraph-note';marker.type='button';
    marker.setAttribute('aria-label','第 '+(index+1)+' 段批注');
    marker.setAttribute('aria-expanded','false');
    if(current?.text)wrap.classList.add('has-reading-note');
    let panel,editor;
    function openNote(selection){
      const note=readNotes().find(item=>item.anchor===anchor);
      if(panel&&!panel.hidden&&!selection){panel.hidden=true;marker.setAttribute('aria-expanded','false');return;}
      if(!panel){
        panel=element(wrap,'section','','reading-note-panel');
        const selected=element(panel,'blockquote',selection||note?.quote||excerptText(block).slice(0,240));
        editor=mountReadingEditor(panel,{text:note?.text??'',label:'段落批注',mode:note?.text?'read':'edit',limit:12000,onChange:text=>{
          const newNote={anchor,quote:selected.textContent.slice(0,240),text};
          const others=readNotes().filter(item=>item.anchor!==anchor);
          saveNotes(text.trim()?[...others,newNote]:others);
          wrap.classList.toggle('has-reading-note',Boolean(text.trim()));
          marker.textContent=text.trim()?'批注':'＋';
        }});
      }
      panel.hidden=false;marker.setAttribute('aria-expanded','true');
      if(!editor.input.hidden)editor.input.focus();
    }
    wrap.addEventListener('pointerup',event=>{
      if(!block.contains(event.target))return;
      const selection=documentRef.getSelection();
      if(!selection||selection.isCollapsed||!block.contains(selection.anchorNode)||!block.contains(selection.focusNode))return;
      const quote=selection.toString().trim().slice(0,240);
      if(quote){
        marker.textContent='批注选文';
        marker.onclick=()=>{openNote(quote);marker.onclick=()=>openNote();marker.textContent='批注';};
      }
    });
  });
  const detached=savedNotes.filter(note=>!matched.has(note.anchor));
  if(detached.length){
    const history=element(body,'details','','reading-note-panel');
    element(history,'summary','已修改段落的批注');
    for(const note of detached){
      element(history,'blockquote',note.quote);
      renderStudyMarkdown(element(history,'div'),note.text);
    }
  }
}
