// Shared native controls for the workspace shell; no knowledge/model mutations.
const paths = {
  menu:'M3 6h18M3 12h18M3 18h18',
  library:'M4 4h6v16H4zM14 4h6v16h-6z',
  structure:'m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
  home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  back:'m15 5-7 7 7 7', forward:'m9 5 7 7-7 7', up:'m5 12 7-7 7 7M12 5v16',
  undo:'M4 5v6h6M4 11a8 8 0 1 1 1 8', redo:'M20 5v6h-6M20 11a8 8 0 1 0-1 8',
  close:'m6 6 12 12M6 18 18 6', more:'M5 11v2M12 11v2M19 11v2',
};
export function createIcon(name, documentRef=document) {
  const svg=documentRef.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.75');
  svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false'); svg.classList.add('ui-icon');
  const path=documentRef.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',paths[name]??paths.more); svg.append(path); return svg;
}
export function syncNavigatorState(controller) {
  const shell=document.querySelector('#appShell'), nav=document.querySelector('#navigator');
  const open=!shell.classList.contains('navigator-collapsed');
  const toggle=document.querySelector('#toggleNavigator');
  toggle.setAttribute('aria-expanded',String(open)); nav.inert=!open;
  if(!open&&nav.contains(document.activeElement))toggle.focus();
  const handle=document.querySelector('#navigatorResizer');
  handle.setAttribute('aria-valuenow',String(controller.preferences.navigatorWidth));
}
export function focusMenu(root) {
  const options=()=>[...root.querySelectorAll('button:not(:disabled)')];
  root.onkeydown=event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const items=options(); if(!items.length)return; event.preventDefault();
    const current=items.indexOf(document.activeElement);
    const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[index].focus();
  };
  options()[0]?.focus();
}
export function bindWorkspaceChrome(controller) {
  const icons={toggleNavigator:'menu',navigatorMenu:'more',moreBtn:'more',homeBtn:'home',backBtn:'back',forwardBtn:'forward',upBtn:'up',undoBtn:'undo',redoBtn:'redo',closePanel:'close'};
  for(const[id,icon]of Object.entries(icons)){
    const button=document.getElementById(id); if(!button)continue;
    button.replaceChildren(createIcon(icon));
    if(!button.hasAttribute('aria-label')){button.setAttribute('aria-label',button.title||'关闭属性面板');button.dataset.i18nAriaLabel=button.dataset.i18nTitle||'关闭属性面板'}
  }
  for(const button of document.querySelectorAll('[data-navigator]')){
    button.querySelector('span')?.replaceChildren(createIcon({outline:'library',library:'structure',search:'search'}[button.dataset.navigator]));
    button.setAttribute('role','tab');button.id=`navigator-tab-${button.dataset.navigator}`;button.setAttribute('aria-controls','navigatorPanel');
  }
  document.querySelector('.navigator-modes').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const items=[...document.querySelectorAll('[data-navigator]')], current=items.indexOf(document.activeElement); if(current<0)return;
    event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;
    items[index].click(); items[index].focus();
  });
  for(const dialog of document.querySelectorAll('dialog')){
    const heading=dialog.querySelector('h2');
    if(heading){heading.id||=`${dialog.id}-title`;dialog.setAttribute('aria-labelledby',heading.id)}
    else {dialog.setAttribute('aria-label','命令行');dialog.dataset.i18nAriaLabel='命令行'}
    for(const button of dialog.querySelectorAll('.dialog-close')){
      if(button.textContent.trim()==='×'){button.setAttribute('aria-label','关闭');button.dataset.i18nAriaLabel='关闭';button.replaceChildren(createIcon('close'))}
    }
  }
  const compact=matchMedia('(max-width:900px)');
  const update=()=>{
    if(controller._desktopNavigatorCollapsed===undefined)controller._desktopNavigatorCollapsed=document.querySelector('#appShell').classList.contains('navigator-collapsed');
    if(compact.matches){
      controller._desktopNavigatorCollapsed=document.querySelector('#appShell').classList.contains('navigator-collapsed');
      document.querySelector('#appShell').classList.add('navigator-collapsed');
    }else document.querySelector('#appShell').classList.toggle('navigator-collapsed',controller._desktopNavigatorCollapsed);
    syncNavigatorState(controller); controller.scheduler.request('responsive-layout');
  };
  compact.addEventListener('change',update);update();
  document.querySelector('#workspace').addEventListener('pointerdown',()=>{
    if(compact.matches&&!document.querySelector('#appShell').classList.contains('navigator-collapsed'))controller.toggleNavigator();
  });
  document.querySelector('#navigator').addEventListener('keydown',event=>{
    if(event.key==='Escape'&&compact.matches){event.preventDefault();controller.toggleNavigator()}
  });
}
