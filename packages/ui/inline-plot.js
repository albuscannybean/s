import {BUILTIN_TEMPLATES} from '../structure-engine/templates.js';
import {createStructureInstance} from '../structure-engine/model.js';
import {parsePlotExpression} from '../structure-engine/plotting.js';
import {renderStructure} from './structure-renderer.js';
import {fitScene} from '../geometry/scene-geometry.js';
import {renderMath} from './math-markup.js';

const allowedStructures=new Set(['builtin:matrix-grid','builtin:n-center','builtin:coordinate-plane']);
const findTemplate=id=>BUILTIN_TEMPLATES.find(item=>item.id===id);
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function mountInlinePlot(root,source,latexCaption){
  const parsed=parsePlotExpression(source);
  const template=findTemplate('builtin:coordinate-plane');
  const instance=createStructureInstance(template,null,{dimension:parsed.dimension,scale:40});
  instance.plotExpressions=[{id:'document-plot',label:source,source,rangeMode:'viewport',range:parsed.range,ranges:parsed.ranges}];
  return mountFigure(root,{instance,template,label:'函数图',latexCaption});
}

export function mountInlineStructure(root,source){
  const id=source.trim();
  if(!allowedStructures.has(id))throw Error('请选择工具箱中的结构');
  const template=findTemplate(id);
  const instance=createStructureInstance(template,null);
  return mountFigure(root,{instance,template,label:template.name??'结构图'});
}

function mountFigure(root,{instance,template,label,latexCaption}){
  const doc=root.ownerDocument;
  const append=(parent,tag,className)=>{
    const item=doc.createElement(tag);
    if(className)item.className=className;
    parent.append(item);
    return item;
  };
  const viewport=append(root,'div','document-plot-viewport');
  viewport.tabIndex=0;
  viewport.setAttribute('role','region');
  viewport.setAttribute('aria-label',label+'。使用方向键平移，使用加减键缩放');
  const sceneRoot=append(viewport,'div','scene-root');
  const layers={};
  for(const name of ['backgroundLayer','geometryLayer','edgeLayer']){
    layers[name]=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    sceneRoot.append(layers[name]);
  }
  for(const [name,css] of [['nodeLayer','node-layer'],['tokenLayer','token-layer']])layers[name]=append(sceneRoot,'div',css);
  const controls=append(root,'div','document-plot-controls');
  const caption=append(controls,'span','document-plot-caption');
  if(latexCaption)renderMath(caption,latexCaption);
  else caption.textContent=label;
  const points=new Map();
  let view=null,lastSize=null,frame=0;
  const size=()=>({width:viewport.clientWidth,height:viewport.clientHeight});
  const render=(viewportSize,worldViewport,quality)=>renderStructure({
    template,instance,sceneRoot,...layers,viewport:viewportSize,worldViewport,quality,zoom:view?.zoom??1
  });
  const reset=(bounds=size())=>{
    if(!bounds.width||!bounds.height||!root.isConnected)return;
    const coordinate=template.id==='builtin:coordinate-plane';
    if(coordinate){
      const zoom=Math.min(bounds.width/480,bounds.height/320,1.3);
      view={zoom,panX:bounds.width/2-500*zoom,panY:bounds.height/2-360*zoom};
    }else view=fitScene(render(bounds).scene,bounds,22);
    draw();
  };
  function draw(){
    frame=0;
    if(!root.isConnected||!view)return;
    const viewportSize=size();
    if(!viewportSize.width||!viewportSize.height)return;
    const {zoom,panX,panY}=view;
    render(viewportSize,{
      left:-panX/zoom,right:(viewportSize.width-panX)/zoom,
      top:-panY/zoom,bottom:(viewportSize.height-panY)/zoom
    },points.size?'drag':'full');
    sceneRoot.style.transform='translate('+panX+'px,'+panY+'px) scale('+zoom+')';
  }
  function schedule(){
    if(!frame)frame=requestAnimationFrame(draw);
  }
  function zoomAt(point,factor){
    if(!view||!Number.isFinite(factor)||factor<=0)return;
    const actual=Math.max(.08,Math.min(8,view.zoom*factor))/view.zoom;
    view={zoom:view.zoom*actual,panX:point.x-(point.x-view.panX)*actual,panY:point.y-(point.y-view.panY)*actual};
    schedule();
  }
  function pan(x,y){
    if(!view)return;
    view.panX+=x;view.panY+=y;schedule();
  }
  function centered(factor){
    const {width,height}=size();
    zoomAt({x:width/2,y:height/2},factor);
  }
  for(const [text,name,action] of [['−','缩小',()=>centered(.8)],['＋','放大',()=>centered(1.25)],['复位','重置视图',()=>reset()]]){
    const button=append(controls,'button');
    button.type='button';button.textContent=text;button.setAttribute('aria-label',name);button.onclick=action;
  }
  function position(event){
    const rect=viewport.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  }
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0||points.size>=2||!view)return;
    points.set(event.pointerId,position(event));
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove',event=>{
    const before=points.get(event.pointerId);
    if(!before)return;
    const after=position(event);
    const other=[...points].find(([id])=>id!==event.pointerId)?.[1];
    if(other){
      const start=midpoint(before,other),end=midpoint(after,other);
      zoomAt(start,distance(after,other)/Math.max(1,distance(before,other)));
      pan(end.x-start.x,end.y-start.y);
    }else pan(after.x-before.x,after.y-before.y);
    points.set(event.pointerId,after);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,event=>{
    if(points.delete(event.pointerId)&&!points.size){viewport.classList.remove('is-dragging');schedule();}
  });
  viewport.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();zoomAt(position(event),Math.exp(-event.deltaY*.004));
  },{passive:false});
  viewport.addEventListener('keydown',event=>{
    const actions={ArrowLeft:()=>pan(-36,0),ArrowRight:()=>pan(36,0),ArrowUp:()=>pan(0,-36),ArrowDown:()=>pan(0,36),
      '+':()=>centered(1.25),'=':()=>centered(1.25),'-':()=>centered(.8),Home:()=>reset()};
    if(actions[event.key]){event.preventDefault();actions[event.key]();}
  });
  const observer=new ResizeObserver(()=>{
    if(!root.isConnected){observer.disconnect();return;}
    const next=size();
    if(!next.width||!next.height)return;
    if(!view)reset(next);
    else if(lastSize)pan((next.width-lastSize.width)/2,(next.height-lastSize.height)/2);
    lastSize=next;
  });
  observer.observe(viewport);
  return {instance,redraw:()=>reset()};
}
