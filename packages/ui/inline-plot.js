import {BUILTIN_TEMPLATES} from '../structure-engine/templates.js';
import {createStructureInstance} from '../structure-engine/model.js';
import {parsePlotExpression} from '../structure-engine/plotting.js';
import {renderStructure} from './structure-renderer.js';
import {fitScene} from '../geometry/scene-geometry.js';

// The same coordinate structure powers document figures and full workspaces.
export function mountInlinePlot(root, source) {
  const doc=root.ownerDocument, template=BUILTIN_TEMPLATES.find(t=>t.id==='builtin:coordinate-plane');
  const parsed=parsePlotExpression(source), instance=createStructureInstance(template,null,{dimension:parsed.dimension,scale:40});
  instance.plotExpressions=[{id:'document-plot',label:source,source,rangeMode:'viewport',range:parsed.range,ranges:parsed.ranges,color:'#2f7658'}];
  const viewport=doc.createElement('div');viewport.className='document-plot-viewport';
  const sceneRoot=doc.createElement('div');sceneRoot.className='scene-root';
  const layers={};for(const key of ['backgroundLayer','geometryLayer','edgeLayer']){layers[key]=doc.createElementNS('http://www.w3.org/2000/svg','svg');sceneRoot.append(layers[key]);}
  for(const key of ['nodeLayer','tokenLayer']){layers[key]=doc.createElement('div');layers[key].className=key==='nodeLayer'?'node-layer':'token-layer';sceneRoot.append(layers[key]);}
  viewport.append(sceneRoot);root.append(viewport);
  const controls=doc.createElement('div');controls.className='document-plot-controls';
  const caption=doc.createElement('code');caption.textContent=source;controls.append(caption);
  let rendered, zoom=1;
  const draw=()=>{const width=viewport.clientWidth||640,height=340;rendered=renderStructure({template,instance,sceneRoot,...layers,viewport:{width,height}});const view=fitScene(rendered.scene,{width,height});zoom=view.zoom;sceneRoot.style.transform='translate('+view.panX+'px,'+view.panY+'px) scale('+zoom+')';};
  for(const[label,action] of [['−',()=>zoomBy(.8)],['＋',()=>zoomBy(1.25)],['适合窗口',draw]]){const button=doc.createElement('button');button.type='button';button.textContent=label;button.onclick=action;controls.append(button);}
  function zoomBy(factor){zoom=Math.max(.015,Math.min(5,zoom*factor));sceneRoot.style.transform=sceneRoot.style.transform.replace(/scale\([^)]*\)/,'scale('+zoom+')');}
  root.append(controls);requestAnimationFrame(draw);
  return {instance, redraw:draw};
}
