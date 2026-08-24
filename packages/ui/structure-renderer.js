import {materializeTemplate} from '../structure-engine/templates.js';

const SVG_NS='http://www.w3.org/2000/svg';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};
const bindingFor=(instance,slotId)=>(instance.bindings??[]).filter(binding=>binding.slotId===slotId);

function targetLabel(binding,knowledge,instances,templates){
  if(binding.targetType==='knowledge')return knowledge.find(item=>item.id===binding.targetId)?.title??'Missing Knowledge';
  if(binding.targetType==='structure'){
    const nested=instances.find(item=>item.id===binding.targetId),template=templates.find(item=>item.id===nested?.templateId);
    return template?.name??'Missing Structure';
  }
  return String(binding.metadata?.value??binding.targetId??binding.targetType);
}

function decorateSlot(node,slot,context){
  const {instance,knowledge,instances,templates,selectedSlotId,onSelectSlot,onOpenNested}=context;
  node.dataset.slotId=slot.id;
  node.tabIndex=0;
  node.setAttribute('role','button');
  node.setAttribute('aria-label',`${slot.label} · ${slot.role}`);
  if(selectedSlotId===slot.id)node.classList.add('selected');
  const bindings=bindingFor(instance,slot.id);
  if(!bindings.length)node.classList.add('empty');
  if(bindings.some(item=>item.targetType==='structure'))node.classList.add('nested');
  const select=event=>{event.stopPropagation();onSelectSlot?.(slot.id)};
  node.addEventListener('click',select);
  node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event)}});
  node.addEventListener('dblclick',event=>{event.stopPropagation();const nested=bindings.find(item=>item.targetType==='structure');if(nested)onOpenNested?.(nested.targetId,slot.id)});
  return bindings;
}

function makeCard(slot,context){
  const card=el('article','slot-card');
  card.style.setProperty('--accent',context.accent??'#557c91');
  const bindings=decorateSlot(card,slot,context);
  card.append(el('div','slot-label',slot.label),el('div','slot-role',slot.role));
  const coordinate=el('span','semantic-coordinate',semanticCoordinate(slot.semanticCoordinate));
  card.append(coordinate);
  if(bindings.length){
    for(const binding of bindings)card.append(el('div','binding-chip',`${binding.targetType==='structure'?'⬡':'◇'} ${targetLabel(binding,context.knowledge,context.instances,context.templates)}`));
  }else card.append(el('div','binding-chip','＋ Bind Knowledge / Structure'));
  return card;
}

function semanticCoordinate(value={}){
  if('x'in value&&'y'in value)return`(${value.x}, ${value.y})`;
  if('column'in value)return`${value.column} · ${value.layer}`;
  if('modularIndex'in value)return`ℤ · ${value.modularIndex}`;
  if('sets'in value)return value.sets.join('∩');
  if('row'in value)return`${value.row},${value.col}`;
  return'';
}

function renderColumns(root,template,context){
  const grid=el('div','slot-grid columns');
  const columns=template.layout.columns??[...new Set(template.slots.map(slot=>slot.semanticCoordinate?.column))];
  for(const columnId of columns){
    const column=el('section','slot-column');
    const heading=el('div','structure-title');
    const names={L:'Layer · 存在层',M:'Mediation · 中介层',N:'Nexus · 内涵层'};
    heading.append(el('h2','',columnId),el('small','',names[columnId]??columnId));
    column.append(heading);
    for(const slot of template.slots.filter(item=>item.semanticCoordinate?.column===columnId).sort((a,b)=>(a.semanticCoordinate.order??0)-(b.semanticCoordinate.order??0)))column.append(makeCard(slot,{...context,accent:template.visual?.accentByColumn?.[columnId]}));
    grid.append(column);
  }
  root.append(grid);
}

function renderRadial(root,template,context){
  const canvas=el('div','radial-structure');canvas.append(el('div','radial-ring'));
  const slots=template.slots;
  slots.forEach((slot,index)=>{
    const angle=((slot.semanticCoordinate?.angle??index*360/slots.length)-90)*Math.PI/180;
    const node=el('button','radial-slot');
    node.style.left=`${310+220*Math.cos(angle)}px`;node.style.top=`${310+220*Math.sin(angle)}px`;
    decorateSlot(node,slot,context);
    node.append(el('span','value',slot.label));
    const binding=bindingFor(context.instance,slot.id)[0];if(binding)node.append(el('small','',targetLabel(binding,context.knowledge,context.instances,context.templates)));
    canvas.append(node);
  });
  const variables=[['A',context.instance.parameters?.A,'#c8922e'],['B',context.instance.runtimeState?.results?.B,'#7657a8']];
  for(const[name,result,color]of variables){if(result==null)continue;const index=((Number(result)%slots.length)+slots.length)%slots.length,angle=((index*360/slots.length)-90)*Math.PI/180,token=el('span','variable-token',name);token.style.left=`${310+(name==='A'?158:185)*Math.cos(angle)}px`;token.style.top=`${310+(name==='A'?158:185)*Math.sin(angle)}px`;token.style.background=color;token.title=`${name} = ${result}`;canvas.append(token)}
  root.append(canvas);
}

function renderPolygon(root,template,context){
  const svg=document.createElementNS(SVG_NS,'svg');svg.classList.add('polygon-svg');svg.setAttribute('viewBox','0 0 620 520');
  const points=template.slots.map((slot,index)=>{const angle=((slot.semanticCoordinate?.angle??index*360/template.slots.length)-90)*Math.PI/180;return{x:310+200*Math.cos(angle),y:260+200*Math.sin(angle),slot}});
  const polygon=document.createElementNS(SVG_NS,'polygon');polygon.classList.add('polygon-shape');polygon.setAttribute('points',points.map(point=>`${point.x},${point.y}`).join(' '));svg.append(polygon);
  for(const point of points){
    const group=document.createElementNS(SVG_NS,'g');group.classList.add('polygon-slot');decorateSlot(group,point.slot,context);
    const circle=document.createElementNS(SVG_NS,'circle');circle.classList.add('polygon-node');circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);circle.setAttribute('r','22');
    const label=document.createElementNS(SVG_NS,'text');label.classList.add('polygon-label');label.setAttribute('x',point.x);label.setAttribute('y',point.y+4);label.textContent=point.slot.label;
    group.append(circle,label);svg.append(group);
  }
  root.append(svg);
}

function renderHasse(root,template,context){
  const canvas=el('div','hasse-canvas'),levels=[...new Set(template.slots.map(slot=>slot.semanticCoordinate?.layer??0))].sort((a,b)=>b-a);
  for(const level of levels){const row=el('div','hasse-level');for(const slot of template.slots.filter(item=>(item.semanticCoordinate?.layer??0)===level))row.append(makeCard(slot,{...context,accent:template.visual?.accent}));canvas.append(row)}
  root.append(canvas);
}

function renderVenn(root,template,context){
  const canvas=el('div','venn-canvas'),sets=template.layout.sets??2,colors=['#527c8b','#c8922e','#7657a8'];
  const positions=sets===2?[[90,80],[230,80]]:[[100,55],[225,55],[162,165]];
  positions.forEach((position,index)=>{const circle=el('div','venn-circle');circle.style.left=`${position[0]}px`;circle.style.top=`${position[1]}px`;circle.style.borderColor=colors[index];circle.style.background=`${colors[index]}18`;canvas.append(circle)});
  const regionPositions=sets===2?[[55,205],[270,205],[470,205]]:[[70,145],[480,145],[280,380],[210,160],[345,160],[280,285],[280,215]];
  template.slots.forEach((slot,index)=>{const node=el('button','venn-region',slot.label);node.style.left=`${regionPositions[index]?.[0]??20}px`;node.style.top=`${regionPositions[index]?.[1]??20}px`;decorateSlot(node,slot,context);canvas.append(node)});
  root.append(canvas);
}

function renderCoordinate(root,template,context){
  const canvas=el('div','coordinate-canvas'),scale=Number(context.instance.parameters?.scale??40);
  for(const slot of template.slots){const point=el('button','coordinate-point',slot.label);point.style.left=`${310+(slot.semanticCoordinate?.x??0)*scale}px`;point.style.top=`${250-(slot.semanticCoordinate?.y??0)*scale}px`;point.title=semanticCoordinate(slot.semanticCoordinate);decorateSlot(point,slot,context);canvas.append(point)}
  root.append(canvas);
}

function renderTable(root,template,context){
  const n=Math.round(Math.sqrt(template.slots.length)),table=el('table','operation-table'),head=el('tr');head.append(el('th','',context.instance.parameters?.operation==='multiply-mod-n'?'×':'＋'));for(let i=0;i<n;i++)head.append(el('th','',String(i)));table.append(head);
  for(let row=0;row<n;row++){const tr=el('tr');tr.append(el('th','',String(row)));for(let col=0;col<n;col++){const slot=template.slots.find(item=>item.semanticCoordinate.row===row&&item.semanticCoordinate.col===col),td=el('td','',slot?.label??'');if(slot)decorateSlot(td,slot,context);tr.append(td)}table.append(tr)}root.append(table);
}

function renderGeneric(root,template,context){
  const canvas=el('div','generic-canvas');
  for(const slot of template.slots)canvas.append(makeCard(slot,{...context,accent:template.visual?.accent}));
  if(!template.slots.length){const empty=el('div','slot-card empty');empty.append(el('div','slot-label','Empty Structure'),el('div','slot-role','Open Structure Builder to add semantic slots.'));canvas.append(empty)}
  root.append(canvas);
}

function drawEdges(edgeLayer,template,container,scale=1){
  edgeLayer.replaceChildren();
  const defs=document.createElementNS(SVG_NS,'defs');
  defs.innerHTML='<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#77877f"/></marker><marker id="arrowBack" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 10 0 L 0 5 L 10 10 z" fill="#77877f"/></marker>';
  edgeLayer.append(defs);
  const base=container.parentElement.getBoundingClientRect();
  for(const edge of template.edges){
    const source=container.querySelector(`[data-slot-id="${CSS.escape(edge.sourceSlotId)}"]`),target=container.querySelector(`[data-slot-id="${CSS.escape(edge.targetSlotId)}"]`);if(!source||!target)continue;
    const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),x1=(a.left+a.width/2-base.left)/scale,y1=(a.top+a.height/2-base.top)/scale,x2=(b.left+b.width/2-base.left)/scale,y2=(b.top+b.height/2-base.top)/scale,curve=Math.max(28,Math.abs(x2-x1)*.28);
    const path=document.createElementNS(SVG_NS,'path');path.classList.add('structure-edge',edge.direction);path.dataset.edgeId=edge.id;path.setAttribute('d',`M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}`);path.setAttribute('aria-label',edge.label||edge.relationType);edgeLayer.append(path);
  }
}

export function renderStructure(options){
  const {container,edgeLayer,instance,template,scale=1}=options;
  container.replaceChildren();edgeLayer.replaceChildren();
  if(!instance||!template)return;
  const resolved=materializeTemplate(template,instance.parameters),root=el('section','structure-root');root.dataset.instanceId=instance.id;
  const title=el('header','structure-title');title.append(el('h2','',resolved.name),el('small','',`${resolved.category} · ${resolved.slots.length} slots · ${resolved.edges.length} edges`));root.append(title);
  const context={...options,template:resolved,templates:options.templates??[template]};
  if(resolved.layout.type==='columns')renderColumns(root,resolved,context);
  else if(resolved.slotFactory==='regular-polygon')renderPolygon(root,resolved,context);
  else if(resolved.layout.type==='radial')renderRadial(root,resolved,context);
  else if(resolved.layout.type==='hasse'||resolved.layout.type==='tree')renderHasse(root,resolved,context);
  else if(resolved.layout.type==='venn')renderVenn(root,resolved,context);
  else if(resolved.layout.type==='coordinate')renderCoordinate(root,resolved,context);
  else if(resolved.layout.type==='table')renderTable(root,resolved,context);
  else renderGeneric(root,resolved,context);
  container.append(root);
  requestAnimationFrame(()=>drawEdges(edgeLayer,resolved,container,scale));
  return resolved;
}

export function renderNestedPreview(container,instance,template){
  container.replaceChildren();if(!instance||!template)return;
  const preview=el('aside','nested-preview');preview.append(el('span','eyebrow','NESTED STRUCTURE'),el('h3','',template.name),el('p','',`${template.slots.length||'dynamic'} slots · Double-click a bound slot to enter.`));container.append(preview);
}
