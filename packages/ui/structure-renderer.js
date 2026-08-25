import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildSceneGeometry,screenToWorld} from '../geometry/scene-geometry.js';

const SVG_NS='http://www.w3.org/2000/svg';
const html=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!=null)element.textContent=text;return element};
const svg=tag=>document.createElementNS(SVG_NS,tag);
const bindingsAt=(instance,slotId)=>(instance.bindings??[]).filter(binding=>binding.slotId===slotId);

function targetLabel(binding,knowledge,instances,templates){
  if(binding.targetType==='knowledge')return knowledge.find(item=>item.id===binding.targetId)?.title??'Missing Knowledge';
  if(binding.targetType==='structure'){const nested=instances.find(item=>item.id===binding.targetId),template=templates.find(item=>item.id===nested?.templateId);return template?.name??'Missing Structure'}
  return String(binding.metadata?.value??binding.targetId??binding.targetType);
}

function coordinateLabel(value={}){if('column'in value)return`${value.column}${value.layer??''}`;if('modularIndex'in value)return`ℤ · ${value.modularIndex}`;if('rank'in value)return`rank ${value.rank}`;if('x'in value&&'y'in value)return`(${value.x}, ${value.y})`;if('row'in value)return`${value.row}, ${value.col}`;if('sets'in value)return value.sets.join('∩');return''}

function markerDefs(edgeLayer){const defs=svg('defs');defs.innerHTML='<marker id="scene-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker><marker id="scene-arrow-back" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 0L0 5L10 10Z" fill="context-stroke"/></marker>';edgeLayer.append(defs)}

function drawColumnAxes(layer,scene){
  if(scene.layout!=='columns')return;const groups=new Map();for(const node of scene.nodes){if(!groups.has(node.column))groups.set(node.column,[]);groups.get(node.column).push(node)}
  for(const nodes of groups.values()){if(nodes.length<2)continue;nodes.sort((a,b)=>a.y-b.y);const path=svg('path'),first=nodes[0],last=nodes.at(-1),x=first.x+first.width/2;path.setAttribute('d',`M ${x} ${first.y+first.height} L ${x} ${last.y}`);path.classList.add('column-axis');layer.append(path)}
}

function drawEdges(layer,scene,options){
  layer.replaceChildren();markerDefs(layer);drawColumnAxes(layer,scene);const selected=new Set(options.selectedIds??[]);
  for(const edge of scene.edges){const group=svg('g');group.classList.add('scene-edge-group');group.dataset.edgeId=edge.id;if(selected.has(`edge:${edge.id}`))group.classList.add('selected');
    const path=svg('path');path.classList.add('scene-edge',edge.direction??'directed',edge.routing,edge.visual?.lineStyle??'solid');path.setAttribute('d',edge.path);path.setAttribute('marker-end',edge.direction==='undirected'?'':'url(#scene-arrow)');if(edge.direction==='bidirectional')path.setAttribute('marker-start','url(#scene-arrow-back)');if(edge.semanticAxis)path.dataset.semanticAxis=edge.semanticAxis;if(edge.visual?.color)path.style.stroke=edge.visual.color;
    const hit=svg('path');hit.classList.add('scene-edge-hit');hit.setAttribute('d',edge.path);hit.addEventListener('click',event=>{event.stopPropagation();options.onSelect?.({kind:'edge',id:edge.id,event})});hit.addEventListener('dblclick',event=>{event.stopPropagation();options.onEdit?.({kind:'edge',id:edge.id,event})});hit.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();options.onContext?.({kind:'edge',id:edge.id,event})});
    group.append(path,hit);if(edge.label){const label=svg('text'),middle=edge.points[Math.floor(edge.points.length/2)]??edge.start;label.classList.add('edge-label');label.setAttribute('x',middle.x);label.setAttribute('y',middle.y-8);label.textContent=edge.label;group.append(label)}layer.append(group)}
}

function createNode(node,context){
  const article=html('article',`scene-node shape-${node.shape??'roundedRect'}`);article.dataset.slotId=node.id;article.tabIndex=0;article.setAttribute('role','button');article.setAttribute('aria-label',`${node.label} · ${node.role}`);article.style.transform=`translate(${node.x}px, ${node.y}px)`;article.style.width=`${node.width}px`;article.style.height=`${node.height}px`;article.style.setProperty('--node-accent',node.column?context.definition.visual?.accentByColumn?.[node.column]:context.definition.visual?.accent??'#557c91');
  const selected=new Set(context.selectedIds??[]),bindings=bindingsAt(context.instance,node.id);if(selected.has(`slot:${node.id}`))article.classList.add('selected');if(!bindings.length)article.classList.add('empty');if(bindings.some(binding=>binding.targetType==='structure'))article.classList.add('nested');if(node.role==='top'||node.role==='bottom')article.classList.add('landmark');
  const top=html('div','node-top'),identity=html('span','node-identity',node.id),role=html('span','node-role',node.role);top.append(identity,role);article.append(top,html('strong','node-label',node.label));
  const coordinate=coordinateLabel(node.semanticCoordinate);if(coordinate)article.append(html('span','node-coordinate',coordinate));
  if(bindings.length){const binding=bindings[0],chip=html('span','node-binding',`${binding.targetType==='structure'?'⬡':'◇'} ${targetLabel(binding,context.knowledge,context.instances,context.templates)}`);article.append(chip);if(bindings.length>1)article.append(html('span','node-count',`+${bindings.length-1}`))}else article.append(html('span','node-empty-action','＋ 引用或创建 Knowledge'));
  article.addEventListener('click',event=>{event.stopPropagation();context.onSelect?.({kind:'slot',id:node.id,event})});
  article.addEventListener('dblclick',event=>{event.stopPropagation();const nested=bindings.find(binding=>binding.targetType==='structure'),knowledgeBinding=bindings.find(binding=>binding.targetType==='knowledge');if(nested)context.onOpenNested?.(nested.targetId,node.id);else if(knowledgeBinding)context.onOpenKnowledge?.(knowledgeBinding.targetId,node.id);else context.onQuickBind?.(node.id,event)});
  article.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();context.onContext?.({kind:'slot',id:node.id,event})});
  article.addEventListener('pointerdown',event=>context.onNodePointerDown?.(event,node));
  article.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();context.onActivate?.({kind:'slot',id:node.id,event})}if(event.key===' '){event.preventDefault();context.onPreview?.({kind:'slot',id:node.id,event})}});return article;
}

function drawNodes(layer,scene,context){layer.replaceChildren();for(const node of scene.nodes)layer.append(createNode(node,context))}
function drawTokens(layer,scene){layer.replaceChildren();for(const token of scene.tokens){const element=html('button','scene-token',token.label);element.dataset.variableId=token.id;element.style.transform=`translate(${token.x}px, ${token.y}px)`;element.style.background=token.color;element.title=`${token.label} = ${token.value}`;element.setAttribute('aria-label',`${token.label} = ${token.value}`);layer.append(element)}}

export function renderSceneGeometry(scene,{sceneRoot,edgeLayer,nodeLayer,tokenLayer,...options}){
  const width=Math.ceil(scene.bounds.x+scene.bounds.width),height=Math.ceil(scene.bounds.y+scene.bounds.height);sceneRoot.style.width=`${width}px`;sceneRoot.style.height=`${height}px`;edgeLayer.setAttribute('width',String(width));edgeLayer.setAttribute('height',String(height));edgeLayer.setAttribute('viewBox',`0 0 ${width} ${height}`);drawEdges(edgeLayer,scene,options);drawNodes(nodeLayer,scene,options);drawTokens(tokenLayer,scene);return scene;
}

export function renderStructure(options){
  const {instance,template}=options;if(!instance||!template)return null;const definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance,{viewport:options.viewport});
  renderSceneGeometry(scene,{...options,definition});return{definition,scene};
}

export function renderMinimap(container,scene,view,viewport,onNavigate){
  container.replaceChildren();if(!scene||scene.nodes.length<8&&scene.bounds.width<viewport.width*1.35&&scene.bounds.height<viewport.height*1.35){container.hidden=true;return}container.hidden=false;
  const map=svg('svg'),padding=8,width=168,height=108,scale=Math.min((width-padding*2)/scene.bounds.width,(height-padding*2)/scene.bounds.height),offsetX=padding-scene.bounds.x*scale,offsetY=padding-scene.bounds.y*scale;map.setAttribute('viewBox',`0 0 ${width} ${height}`);
  for(const node of scene.nodes){const rect=svg('rect');rect.classList.add('minimap-node');rect.setAttribute('x',node.x*scale+offsetX);rect.setAttribute('y',node.y*scale+offsetY);rect.setAttribute('width',Math.max(2,node.width*scale));rect.setAttribute('height',Math.max(2,node.height*scale));map.append(rect)}
  const worldTopLeft=screenToWorld({x:0,y:0},view),viewRect=svg('rect');viewRect.classList.add('minimap-viewport');viewRect.setAttribute('x',worldTopLeft.x*scale+offsetX);viewRect.setAttribute('y',worldTopLeft.y*scale+offsetY);viewRect.setAttribute('width',viewport.width/view.zoom*scale);viewRect.setAttribute('height',viewport.height/view.zoom*scale);map.append(viewRect);container.append(map);
  const navigate=event=>{const rect=map.getBoundingClientRect(),world={x:(event.clientX-rect.left-offsetX)/scale,y:(event.clientY-rect.top-offsetY)/scale};onNavigate?.(world)};map.addEventListener('pointerdown',event=>{map.setPointerCapture(event.pointerId);navigate(event)});map.addEventListener('pointermove',event=>{if(map.hasPointerCapture(event.pointerId))navigate(event)});
}

export function renderNestedPreview(container,instance,template){container.replaceChildren();if(!instance||!template)return;const preview=html('aside','nested-preview');preview.append(html('span','eyebrow','NESTED STRUCTURE'),html('h3','',template.name),html('p','',`${template.slots.length||'dynamic'} slots · 双击进入，Space 快速预览。`));container.append(preview)}
