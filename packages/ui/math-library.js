const icons={
  nodes:'<circle cx="5" cy="12" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="m7 11 9-5M7 13l9 5"/>',
  curve:'<path d="M3 18C9 18 8 6 15 6h6M4 4v16h16"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01m4 4h.01m4 4h.01"/>',
  axes:'<path d="M4 4v16h16m-13-4 4-5 4 2 5-7"/>',
  matrix:'<path d="M7 4H4v16h3m10-16h3v16h-3M9 8h.01m6 0h.01m-6 4h.01m6 0h.01m-6 4h.01m6 0h.01"/>',
  circle:'<circle cx="12" cy="12" r="8"/><path d="M12 4v3m8 5h-3m-5 8v-3m-8-5h3"/>',
  book:'<path d="M4 5h7v15H4zm9 0h7v15h-7M7 9h1m8 0h1"/>',
  folder:'<path d="M3 7V5h6l2 2h10v12H3Z"/>',
  pen:'<path d="m4 16 11-11 4 4L8 20l-4 1Zm9-9 4 4"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  download:'<path d="M12 4v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v6l3 2"/>',
  theme:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>',
  info:'<circle cx="12" cy="12" r="8"/><path d="M12 11v5m0-8h.01"/>',
  more:'<path d="M5 12h.01m7 0h.01m7 0h.01"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>'
};
export const icon=name=>icons[name]?`<svg class="site-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`:'';

const storageKey='lmn:math-library:folders';
export class MathCollections {
  read(){
    try{
      const data=JSON.parse(localStorage.getItem(storageKey)||'[]');
      return Array.isArray(data)?data.filter(folder=>typeof folder?.name==='string'&&Array.isArray(folder.items)):[];
    }catch{return []}
  }
  update(id,name,action){
    const folders=this.read();
    let folder=folders.find(x=>x.name===name);
    if(!folder){
      if(action==='remove'||!name||name.length>40)throw Error('请输入 1 至 40 字的收藏夹名称。');
      folder={name,items:[]};folders.push(folder);
    }
    folder.items=action==='remove'?folder.items.filter(item=>item!==id):[...new Set([...folder.items,id])];
    localStorage.setItem(storageKey,JSON.stringify(folders));
  }
}

