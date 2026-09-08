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

/** Small schematic glyphs for browsing: no materialization, labels or user content. */
export function createLibraryPreview(template,doc=globalThis.document){
 const root=doc.createElementNS(ns,'svg');root.classList.add('template-miniature');root.setAttribute('viewBox','0 0 120 72');root.setAttribute('aria-hidden','true');
 const add=(tag,attrs)=>{const e=doc.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));root.append(e);return e};
 const line=(a,b)=>add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'mini-line'});
 const node=(p,r=5)=>add('circle',{cx:p[0],cy:p[1],r,class:'mini-node'});
 const graph=(points,edges)=>{for(const[a,b]of edges)line(points[a],points[b]);for(const p of points)node(p)};
 const id=template.id??'',factory=template.slotFactory??'',layout=template.layout?.type??'';
 if(id.includes('empty-custom')){add('rect',{x:25,y:14,width:70,height:44,rx:8,class:'mini-line','stroke-dasharray':'4 4'});line([52,36],[68,36]);line([60,28],[60,44])}
 else if(id.includes('n-center')||factory==='semantic:n-center')graph([[60,36],[60,10],[99,36],[60,62],[21,36]],[[0,1],[0,2],[0,3],[0,4]]);
 else if(id.includes('lmn-432')){for(const[x,count]of[[25,4],[60,3],[95,2]])for(let n=0;n<count;n++)add('rect',{x:x-6,y:7+n*15,width:12,height:9,rx:2,class:'mini-node'});line([31,26],[54,27]);line([66,42],[89,27])}
 else if(layout==='venn'||id.includes('venn')){add('ellipse',{cx:46,cy:36,rx:24,ry:25,class:'mini-line'});add('ellipse',{cx:74,cy:36,rx:24,ry:25,class:'mini-line'})}
 else if(layout==='coordinate'){line([15,50],[105,50]);line([30,62],[30,8]);add('path',{d:'M34 46 Q58 10 92 25',class:'mini-line'});line([30,50],[77,20]);node([77,20],3)}
 else if(/matrix|operation-table|cartesian/.test(id)||['table','matrix'].includes(layout)){for(let x=0;x<4;x++)line([30+x*20,12],[30+x*20,60]);for(let y=0;y<4;y++)line([30,12+y*16],[90,12+y*16])}
 else if(/equivalence|partition/.test(id)){for(const[x,y]of[[33,24],[84,24],[60,53]]){add('ellipse',{cx:x,cy:y,rx:18,ry:13,class:'mini-line'});node([x-6,y],2);node([x+6,y],2)}}
 else if(/mapping|permutation/.test(id)){const points=[[28,14],[28,36],[28,58],[92,14],[92,36],[92,58]];graph(points,[[0,4],[1,5],[2,3]])}
 else if(/commutative/.test(id))graph([[32,15],[88,15],[32,57],[88,57]],[[0,1],[0,2],[1,3],[2,3]]);
 else if(layout==='hasse'||id.includes('boolean'))graph([[60,8],[30,36],[60,36],[90,36],[60,64]],[[0,1],[0,2],[0,3],[1,4],[2,4],[3,4]]);
 else if(layout==='tree'||/tree/.test(id))graph([[60,10],[32,34],[88,34],[18,59],[44,59],[76,59],[102,59]],[[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]]);
 else if(layout==='radial'||/cyclic|mod-|polygon|transformation/.test(id)||id==='scheme'){
  const points=Array.from({length:6},(_,n)=>[60+28*Math.cos(n*Math.PI/3-Math.PI/2),36+28*Math.sin(n*Math.PI/3-Math.PI/2)]);graph(points,points.map((_,n)=>[n,(n+1)%6]));
 }
 else if(factory==='directed-node-family'||layout==='timeline')graph([[15,36],[45,36],[75,36],[105,36]],[[0,1],[1,2],[2,3]]);
 else graph([[22,36],[58,13],[98,36],[58,59]],[[0,1],[1,2],[2,3],[3,0]]);
 return root;
}
