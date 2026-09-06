import {createStructureInstance,materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildSceneGeometry} from '../geometry/scene-geometry.js';
const ns='http://www.w3.org/2000/svg';
export function createSemanticPreview(template,doc=globalThis.document) {
 const svg=doc.createElementNS(ns,'svg');svg.classList.add('template-semantic-preview');svg.setAttribute('aria-label',template.name);
 try{
  const instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance);
  const markerId='preview-arrow-'+Math.random().toString(36).slice(2),defs=doc.createElementNS(ns,'defs'),marker=doc.createElementNS(ns,'marker');for(const[k,v]of Object.entries({id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'}))marker.setAttribute(k,String(v));const arrow=doc.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','#66877b');marker.append(arrow);defs.append(marker);svg.append(defs);
  const nodes=scene.nodes,margin=110,x=Math.min(...nodes.map(n=>n.x))-margin,y=Math.min(...nodes.map(n=>n.y))-margin,right=Math.max(...nodes.map(n=>n.x+n.width))+margin,bottom=Math.max(...nodes.map(n=>n.y+n.height))+margin;
  svg.setAttribute('viewBox',nodes.length?[x,y,right-x,bottom-y].join(' '):'0 0 100 60');
  for(const item of scene.background??[]){if(!['circle','ellipse','path','line','rect','polygon'].includes(item.type))continue;const shape=doc.createElementNS(ns,item.type);for(const[key,value]of Object.entries(item))if(['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points','fill','stroke','stroke-width','opacity','stroke-dasharray'].includes(key)&&value!=null)shape.setAttribute(key,String(value));if(!shape.hasAttribute('stroke'))shape.setAttribute('stroke','#8aa69a');if(!shape.hasAttribute('fill'))shape.setAttribute('fill','none');svg.append(shape);}
  for(const e of scene.edges){const path=doc.createElementNS(ns,'path');path.setAttribute('d',e.path);path.setAttribute('fill','none');path.setAttribute('stroke','#66877b');path.setAttribute('stroke-width','5');if(e.direction==='directed')path.setAttribute('marker-end','url(#'+markerId+')');svg.append(path);}
  for(const n of nodes){const shape=doc.createElementNS(ns,'rect');for(const[key,value]of Object.entries({x:n.x,y:n.y,width:n.width,height:n.height,rx:n.shape==='circle'?n.width/2:12,fill:n.hostAnchor?'#d9eee3':'#ffffff',stroke:'#2f7658','stroke-width':4}))shape.setAttribute(key,String(value));svg.append(shape);
   const label=doc.createElementNS(ns,'text');label.textContent=n.label;label.setAttribute('x',String(n.x+n.width/2));label.setAttribute('y',String(n.y+n.height/2));label.setAttribute('text-anchor','middle');label.setAttribute('dominant-baseline','middle');label.setAttribute('font-size','24');label.setAttribute('fill','#173e2e');svg.append(label);
  }
 }catch(error){const title=doc.createElementNS(ns,'title');title.textContent=error.message;svg.append(title);}
 return svg;
}
