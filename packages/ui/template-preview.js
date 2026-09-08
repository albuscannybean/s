import {createStructureInstance,materializeInstanceDefinition} from '../structure-engine/model.js';
import {getStructureInteractionAdapter} from '../structure-engine/interaction-adapters.js';
import {buildSceneGeometry} from '../geometry/scene-geometry.js';
const ns='http://www.w3.org/2000/svg';
export function buildTemplatePreviewScene(template,parameters={}){
 for(const p of template.parameters??[]){
  const value=parameters[p.id]??p.defaultValue;
  if(p.type==='number'&&(!Number.isFinite(Number(value))||value===''||p.min!=null&&Number(value)<p.min||p.max!=null&&Number(value)>p.max))throw new Error(p.label+': '+(p.min??'−∞')+' – '+(p.max??'∞'));
  if(p.type==='enum'&&!(p.options??[]).some(o=>String(typeof o==='object'?o.value:o)===String(value)))throw new Error(p.label+': '+String(value));
 }
 const instance=createStructureInstance(template,null,parameters),adapter=getStructureInteractionAdapter(template);
 instance.structureView.arrangement=template.viewCapability?.defaultArrangement??null;
 const definition=adapter.prepareDefinition(materializeInstanceDefinition(template,instance),instance),validation=adapter.validateStructure(definition,instance);
 if(validation.valid===false)throw new Error(validation.errors.join('; '));
 const scene=buildSceneGeometry(definition,instance);
 if(!Object.values(scene.bounds).every(Number.isFinite)||scene.nodes.some(n=>![n.x,n.y,n.width,n.height].every(Number.isFinite)))throw new Error('Invalid geometry');
 return{instance,definition,scene};
}
export function createSemanticPreview(template,doc=globalThis.document,options={}){
 const svg=doc.createElementNS(ns,'svg'),language=options.language??doc.documentElement?.lang??'zh-CN',en=language==='en';
 svg.classList.add('template-semantic-preview');svg.setAttribute('aria-label',template.nameI18n?.[language]??template.name);
 const add=(tag,attrs={},text)=>{const e=doc.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))if(v!=null)e.setAttribute(k,String(v));if(text!=null)e.textContent=text;svg.append(e);return e;};
 try{
  const {scene}=options.result??buildTemplatePreviewScene(template,options.parameters??{}),nodes=scene.nodes;
  svg.dataset.previewStatus=nodes.length||scene.background?.length?'ready':'empty';svg.dataset.nodeCount=nodes.length;svg.dataset.edgeCount=scene.edges.length;
  // Use the same full geometry as the canvas, including axes, set boundaries and tables.
  const background=scene.background??[],bounds=background.length?scene.bounds:nodes.length?{x:Math.min(...nodes.map(n=>n.x))-42,y:Math.min(...nodes.map(n=>n.y))-42,width:Math.max(...nodes.map(n=>n.x+n.width))-Math.min(...nodes.map(n=>n.x))+84,height:Math.max(...nodes.map(n=>n.y+n.height))-Math.min(...nodes.map(n=>n.y))+84}:scene.bounds;
  svg.setAttribute('viewBox',[bounds.x,bounds.y,bounds.width,bounds.height].join(' '));
  const markerId='preview-arrow-'+Math.random().toString(36).slice(2),defs=add('defs'),marker=doc.createElementNS(ns,'marker');
  for(const[k,v]of Object.entries({id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'}))marker.setAttribute(k,String(v));
  const arrow=doc.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','#66877b');marker.append(arrow);defs.append(marker);
  for(const item of background){
   if(!['circle','ellipse','path','line','rect','polygon','text'].includes(item.type))continue;
   const attrs={fill:'none',stroke:'#8aa69a'};
   for(const[key,value]of Object.entries(item))if(['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points','fill','stroke','stroke-width','opacity','stroke-dasharray','font-size','text-anchor'].includes(key)&&value!=null)attrs[key]=value;
   if(item.type==='text'){attrs.fill='#476555';attrs.stroke='none'}
   add(item.type,attrs,item.text);
  }
  for(const e of scene.edges){
   const attrs={d:e.path,fill:'none',stroke:e.visual?.color??'#66877b','stroke-width':e.visual?.width??2.5,opacity:e.visual?.opacity??1,'data-edge-id':e.id,'data-routing':e.routing};
   if(e.visual?.lineStyle==='dashed')attrs['stroke-dasharray']='7 5';
   if(e.visual?.lineStyle==='dotted')attrs['stroke-dasharray']='2 4';
   if(e.visual?.arrow==='both'||e.visual?.arrow!=='none'&&e.direction!=='undirected')attrs['marker-end']='url(#'+markerId+')';
   if(e.visual?.arrow==='both'||e.visual?.arrow!=='none'&&e.direction==='bidirectional')attrs['marker-start']='url(#'+markerId+')';
   add('path',attrs);
  }
  for(const n of nodes){
   add(n.shape==='circle'?'ellipse':'rect',n.shape==='circle'?{cx:n.x+n.width/2,cy:n.y+n.height/2,rx:n.width/2,ry:n.height/2,fill:'#fff',stroke:'#2f7658','stroke-width':2.5,'data-slot-id':n.id}:{x:n.x,y:n.y,width:n.width,height:n.height,rx:12,fill:n.hostAnchor?'#d9eee3':'#fff',stroke:'#2f7658','stroke-width':2.5,'data-slot-id':n.id});
   add('text',{x:n.x+n.width/2,y:n.y+n.height/2,'text-anchor':'middle','dominant-baseline':'middle','font-size':Math.min(24,n.height*.36),'fill':'#173e2e'},n.displayLabel??n.label);
  }
  if(!nodes.length&&!background.length){
   svg.setAttribute('viewBox','0 0 420 160');add('text',{x:210,y:68,'text-anchor':'middle',fill:'#476555','font-size':18},en?'Empty structure':'空白结构');
   add('text',{x:210,y:101,'text-anchor':'middle',fill:'#71837a','font-size':14},en?'Add nodes or configure a starting model.':'可添加节点，或配置初始模型。');
  }
 }catch(error){
  svg.dataset.previewStatus='error';svg.dataset.previewError=error.message;svg.setAttribute('viewBox','0 0 420 120');
  add('text',{x:210,y:45,'text-anchor':'middle',fill:'#a33','font-size':17},en?'Preview unavailable':'预览无法生成');
  add('text',{x:210,y:80,'text-anchor':'middle',fill:'#a33','font-size':13},error.message);
 }
 return svg;
}
