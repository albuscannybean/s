import {flattenNavigator} from '../navigation/location-index.js';

const glyph={knowledge:'◇',structure:'⬡',slot:'▣',content:'✎',note:'✎',variable:'ƒ',relation:'↝',geometry:'⌖',board:'▦',group:'≡'};
const messages={
 'zh-CN':{empty:'内容库为空。新建知识或导入知识包后，所有位置会显示在这里。',none:'没有匹配内容。',expand:'展开',collapse:'折叠',menu:'操作',reference:'引用 · 跳转原位置',result:'个结果',items:'个位置',recovered:'已保留的原位置'},
 en:{empty:'Create knowledge or import a package to browse all locations here.',none:'No matching content.',expand:'Expand',collapse:'Collapse',menu:'Actions',reference:'Reference · Open original location',result:'results',items:'locations',recovered:'Retained original location'}
};
export function renderKnowledgeNavigator(root,options={}){
 const {index,expanded=new Set(),activeTarget,query='',language='zh-CN',onOpen,onToggle,onMenu,onDrag,onDrop}=options;
 const strings=messages[language]??messages['zh-CN'],scroll=root.scrollTop,focused=root.ownerDocument.activeElement?.closest('[data-nav-key]')?.dataset.navKey;
 const rows=flattenNavigator(index,{expanded,query}),active=index.find(activeTarget??{})?.key,doc=root.ownerDocument;
 root.replaceChildren();root.classList.add('knowledge-location-tree');root.setAttribute('role','tree');root.setAttribute('aria-label',language==='en'?'Content library':'内容库');
 if(!rows.length){const empty=doc.createElement('p');empty.className='nav-empty';empty.textContent=query?strings.none:strings.empty;root.append(empty);return}
 const count=doc.createElement('p');count.className='nav-location-count';count.textContent=`${query?rows.length:index.objects.size} ${query?strings.result:strings.items}`;root.append(count);
 rows.forEach((entry,position)=>{
  const row=doc.createElement('div');row.className='nav-location-row';row.dataset.navKey=entry.rowKey??entry.key;row.dataset.objectKey=entry.key;row.dataset.kind=entry.kind;row.style.setProperty('--indent',String(entry.indent));
  row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(entry.depth+1));if(entry.expandable)row.setAttribute('aria-expanded',String(entry.expanded));
  row.tabIndex=position===0?0:-1;
  if(entry.key===active&&!entry.reference){row.classList.add('active');row.setAttribute('aria-current','page')}
  if(entry.reference)row.classList.add('reference');
  const toggle=doc.createElement('button');toggle.className='nav-location-toggle';toggle.tabIndex=-1;toggle.textContent=entry.expandable?(entry.expanded?'▾':'▸'):'·';toggle.disabled=!entry.expandable;toggle.title=entry.expanded?strings.collapse:strings.expand;toggle.setAttribute('aria-label',toggle.title);toggle.onclick=event=>{event.stopPropagation();row.focus();onToggle?.(entry.key)};
  const open=doc.createElement('button');open.className='nav-location-open';open.tabIndex=-1;const symbol=doc.createElement('span');symbol.className='nav-location-icon';symbol.textContent=entry.reference?'↗':glyph[entry.kind]??'·';
  const label=doc.createElement('span');label.className='nav-location-label';label.textContent=entry.label;open.append(symbol,label);
  const path=entry.path?.map(s=>s.label).join(' › ')??entry.label;open.title=entry.reference?strings.reference+'\n'+path:path;
  if(entry.reference||entry.searchResult||entry.recovered){const meta=doc.createElement('small');meta.textContent=entry.reference?strings.reference:entry.recovered?strings.recovered:entry.meta;open.append(meta)}
  open.onclick=()=>{if(entry.synthetic){row.focus();onToggle?.(entry.key)}else onOpen?.(entry)};row.append(toggle,open);
  if(entry.expandable){const badge=doc.createElement('small');badge.className='nav-location-badge';badge.textContent=entry.childCount;row.append(badge)}
  if(onMenu&&!entry.synthetic&&entry.kind!=='group'){const menu=doc.createElement('button');menu.className='nav-location-menu';menu.tabIndex=-1;menu.textContent='⋯';menu.title=strings.menu;menu.onclick=e=>onMenu(entry,e);row.append(menu)}
  if(!entry.reference){onDrag?.(row,entry);onDrop?.(row,entry)}
  row.onkeydown=event=>{
   const elements=[...root.querySelectorAll('[role=treeitem]')],at=elements.indexOf(row),focus=next=>{if(next){elements.forEach(e=>e.tabIndex=-1);next.tabIndex=0;next.focus()}};
   if(event.key==='ArrowDown')focus(elements[at+1]);else if(event.key==='ArrowUp')focus(elements[at-1]);else if(event.key==='Home')focus(elements[0]);else if(event.key==='End')focus(elements.at(-1));
   else if(event.key==='ArrowRight'){if(entry.expandable&&!entry.expanded)onToggle?.(entry.key);else if(entry.expandable)focus(elements[at+1]);}
   else if(event.key==='ArrowLeft'){if(entry.expandable&&entry.expanded)onToggle?.(entry.key);else{const parent=index.parents.get(entry.key);focus(elements.find(e=>e.dataset.objectKey===parent));}}
   else if(event.key==='Enter'||event.key===' '){entry.synthetic?onToggle?.(entry.key):onOpen?.(entry)}
   else return;event.preventDefault();
  };
  root.append(row);
 });
 root.scrollTop=scroll;if(focused){const target=[...root.querySelectorAll('[data-nav-key]')].find(e=>e.dataset.navKey===focused);target?.focus({preventScroll:true})}
}

