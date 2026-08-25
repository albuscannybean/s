const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const DEFAULT_NODE_SIZE=Object.freeze({width:188,height:92});

export function worldToScreen(point,view={zoom:1,panX:0,panY:0}){
  return{x:point.x*view.zoom+view.panX,y:point.y*view.zoom+view.panY};
}

export function screenToWorld(point,view={zoom:1,panX:0,panY:0}){
  const zoom=view.zoom||1;return{x:(point.x-view.panX)/zoom,y:(point.y-view.panY)/zoom};
}

export function anchorPoint(node,toward){
  const center={x:node.x+node.width/2,y:node.y+node.height/2};
  const dx=toward.x-center.x,dy=toward.y-center.y;
  if(!dx&&!dy)return center;
  if(node.shape==='circle'){
    const radius=Math.min(node.width,node.height)/2,length=Math.hypot(dx,dy)||1;
    return{x:center.x+dx/length*radius,y:center.y+dy/length*radius};
  }
  if(node.shape==='pill'){
    const rx=node.width/2,ry=node.height/2,length=Math.sqrt((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry))||1;
    return{x:center.x+dx/length,y:center.y+dy/length};
  }
  const halfW=node.width/2,halfH=node.height/2,scale=1/Math.max(Math.abs(dx)/halfW,Math.abs(dy)/halfH);
  const raw={x:center.x+dx*scale,y:center.y+dy*scale};
  if(node.shape!=='roundedRect')return raw;
  const radius=clamp(node.radius??12,0,Math.min(halfW,halfH));
  const local={x:raw.x-center.x,y:raw.y-center.y};
  const cornerX=halfW-radius,cornerY=halfH-radius;
  if(Math.abs(local.x)<=cornerX||Math.abs(local.y)<=cornerY)return raw;
  const corner={x:Math.sign(local.x)*cornerX,y:Math.sign(local.y)*cornerY};
  const vx=local.x-corner.x,vy=local.y-corner.y,length=Math.hypot(vx,vy)||1;
  return{x:center.x+corner.x+vx/length*radius,y:center.y+corner.y+vy/length*radius};
}

export function routeEdge(source,target,style='bezier',options={}){
  const sourceCenter={x:source.x+source.width/2,y:source.y+source.height/2};
  const targetCenter={x:target.x+target.width/2,y:target.y+target.height/2};
  const start=anchorPoint(source,targetCenter),end=anchorPoint(target,sourceCenter);
  if(style==='straight')return{start,end,points:[start,end],path:`M ${start.x} ${start.y} L ${end.x} ${end.y}`};
  if(style==='orthogonal'){
    const horizontal=Math.abs(end.x-start.x)>=Math.abs(end.y-start.y);
    const points=horizontal?[start,{x:(start.x+end.x)/2,y:start.y},{x:(start.x+end.x)/2,y:end.y},end]:[start,{x:start.x,y:(start.y+end.y)/2},{x:end.x,y:(start.y+end.y)/2},end];
    return{start,end,points,path:`M ${points.map((point,index)=>`${index?'L ':''}${point.x} ${point.y}`).join(' ')}`};
  }
  if(style==='radial-arc'){
    const center=options.center??{x:(start.x+end.x)/2,y:(start.y+end.y)/2};
    const radius=Math.max(20,Math.hypot(start.x-center.x,start.y-center.y));
    const sweep=((start.x-center.x)*(end.y-center.y)-(start.y-center.y)*(end.x-center.x))>=0?1:0;
    return{start,end,points:[start,end],path:`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`};
  }
  const dx=end.x-start.x,dy=end.y-start.y,horizontal=Math.abs(dx)>=Math.abs(dy),bend=clamp((horizontal?Math.abs(dx):Math.abs(dy))*.42,36,180);
  const c1=horizontal?{x:start.x+Math.sign(dx||1)*bend,y:start.y}:{x:start.x,y:start.y+Math.sign(dy||1)*bend};
  const c2=horizontal?{x:end.x-Math.sign(dx||1)*bend,y:end.y}:{x:end.x,y:end.y-Math.sign(dy||1)*bend};
  return{start,end,points:[start,c1,c2,end],path:`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`};
}

function gridLayout(slots,options={}){
  const columns=options.columns??Math.max(1,Math.ceil(Math.sqrt(slots.length))),gapX=options.gapX??56,gapY=options.gapY??32,width=options.width??DEFAULT_NODE_SIZE.width,height=options.height??DEFAULT_NODE_SIZE.height;
  return slots.map((slot,index)=>({...slot,x:options.x??96+(index%columns)*(width+gapX),y:options.y??116+Math.floor(index/columns)*(height+gapY),width,height,shape:slot.visual?.shape??'roundedRect'}));
}

function columnsLayout(definition){
  const columns=definition.layout?.columns??['L','M','N'],xStart=100,gap=94,width=208,height=104;
  return definition.slots.map(slot=>{
    const column=slot.semanticCoordinate?.column??columns[0],columnIndex=Math.max(0,columns.indexOf(column)),order=(slot.semanticCoordinate?.order??slot.semanticCoordinate?.layer??1)-1;
    return{...slot,x:xStart+columnIndex*(width+gap),y:150+order*(height+28),width,height,shape:'roundedRect',column};
  });
}

function radialLayout(definition,instance){
  const count=Math.max(1,definition.slots.length),center={x:500,y:390},radius=Number(instance.parameters?.radius??(count>16?270:225)),size=count>18?60:count>12?70:82;
  return definition.slots.map((slot,index)=>{const degrees=slot.semanticCoordinate?.angle??index*360/count,angle=(degrees-90)*Math.PI/180;return{...slot,x:center.x+radius*Math.cos(angle)-size/2,y:center.y+radius*Math.sin(angle)-size/2,width:size,height:size,shape:'circle'};});
}

function layeredLayout(definition){
  const groups=new Map();
  for(const slot of definition.slots){const layer=Number(slot.semanticCoordinate?.rank??slot.semanticCoordinate?.layer??0);if(!groups.has(layer))groups.set(layer,[]);groups.get(layer).push(slot)}
  const layers=[...groups.keys()].sort((a,b)=>b-a),maxCount=Math.max(1,...[...groups.values()].map(items=>items.length)),width=maxCount>10?108:156,height=maxCount>10?66:82,gapX=maxCount>10?18:34;
  return layers.flatMap((layer,row)=>{const items=groups.get(layer).sort((a,b)=>(a.semanticCoordinate?.order??0)-(b.semanticCoordinate?.order??0)),total=items.length*width+(items.length-1)*gapX,start=Math.max(70,(1040-total)/2);return items.map((slot,index)=>({...slot,x:start+index*(width+gapX),y:112+row*(height+68),width,height,shape:'roundedRect'}))});
}

function treeLayout(definition){
  const incoming=new Map(definition.slots.map(slot=>[slot.id,0]));for(const edge of definition.edges)incoming.set(edge.targetSlotId,(incoming.get(edge.targetSlotId)??0)+1);
  const roots=definition.slots.filter(slot=>!incoming.get(slot.id)),depth=new Map(roots.map(slot=>[slot.id,0])),queue=roots.map(slot=>slot.id);
  while(queue.length){const id=queue.shift(),level=depth.get(id);for(const edge of definition.edges.filter(item=>item.sourceSlotId===id))if(!depth.has(edge.targetSlotId)){depth.set(edge.targetSlotId,level+1);queue.push(edge.targetSlotId)}}
  const decorated={...definition,slots:definition.slots.map((slot,index)=>({...slot,semanticCoordinate:{...slot.semanticCoordinate,layer:depth.get(slot.id)??0,order:index}}))};return layeredLayout(decorated);
}

function coordinateLayout(definition,instance){
  const scale=Number(instance.parameters?.scale??54),center={x:500,y:360};return definition.slots.map(slot=>({...slot,x:center.x+(slot.semanticCoordinate?.x??0)*scale-38,y:center.y-(slot.semanticCoordinate?.y??0)*scale-38,width:76,height:76,shape:'circle'}));
}

function tableLayout(definition){
  const n=Math.max(1,Math.round(Math.sqrt(definition.slots.length))),size=54;return definition.slots.map((slot,index)=>({...slot,x:170+(slot.semanticCoordinate?.col??index%n)*size,y:128+(slot.semanticCoordinate?.row??Math.floor(index/n))*size,width:size,height:size,shape:'rect'}));
}

function vennLayout(definition){
  const fixed=[[160,270],[438,270],[716,270],[300,175],[576,175],[438,380],[438,270]];return definition.slots.map((slot,index)=>({...slot,x:fixed[index]?.[0]??120+(index%4)*210,y:fixed[index]?.[1]??140+Math.floor(index/4)*120,width:150,height:68,shape:'pill'}));
}

function applyOffsets(nodes,instance){
  const offsets=instance.layoutState?.visualOffsets??{},positions=instance.layoutState?.nodePositions??{};
  return nodes.map(node=>{const override=positions[node.id],offset=offsets[node.id]??{};return{...node,x:override?.x??node.x+Number(offset.x??0),y:override?.y??node.y+Number(offset.y??0),width:override?.width??node.width,height:override?.height??node.height}});
}

function sceneTokens(definition,instance,nodes){
  if(definition.layout?.type!=='radial')return[];
  const byIndex=new Map(nodes.map(node=>[Number(node.semanticCoordinate?.modularIndex),node])),variables=instance.variables??[];
  const groups=new Map();
  for(const variable of variables){const value=instance.runtimeState?.results?.[variable.id]??instance.runtimeState?.variables?.[variable.id]??variable.value;if(value==null)continue;const modulus=Number(instance.parameters?.modulus??definition.slots.length)||definition.slots.length,index=((Number(value)%modulus)+modulus)%modulus;if(!groups.has(index))groups.set(index,[]);groups.get(index).push({...variable,value,index})}
  return[...groups.entries()].flatMap(([index,items])=>items.map((item,itemIndex)=>{const node=byIndex.get(index)??nodes[index%nodes.length],angle=Math.atan2(node.y+node.height/2-390,node.x+node.width/2-500),ring=105-itemIndex*28;return{id:item.id,label:item.label??item.id,value:item.value,index,x:500+ring*Math.cos(angle)-17,y:390+ring*Math.sin(angle)-17,width:34,height:34,color:item.color??['#c8922e','#7657a8','#2f7658','#557c91'][itemIndex%4]}}));
}

export function buildSceneGeometry(definition,instance={},options={}){
  const layout=definition.layout?.type??'grid';let nodes;
  if(layout==='columns')nodes=columnsLayout(definition);
  else if(layout==='radial')nodes=radialLayout(definition,instance);
  else if(layout==='hasse'||layout==='layered')nodes=layeredLayout(definition);
  else if(layout==='tree')nodes=treeLayout(definition);
  else if(layout==='coordinate')nodes=coordinateLayout(definition,instance);
  else if(layout==='table')nodes=tableLayout(definition);
  else if(layout==='venn')nodes=vennLayout(definition);
  else nodes=gridLayout(definition,{columns:layout==='timeline'?definition.slots.length:undefined});
  nodes=applyOffsets(nodes,instance);const byId=new Map(nodes.map(node=>[node.id,node]));
  const center=layout==='radial'?{x:500,y:390}:undefined;
  const edges=definition.edges.flatMap(edge=>{const source=byId.get(edge.sourceSlotId),target=byId.get(edge.targetSlotId);if(!source||!target)return[];const routing=edge.routing??definition.visual?.edgeRouting??(['columns','tree'].includes(layout)?'bezier':layout==='radial'?'radial-arc':layout==='hasse'?'straight':'orthogonal');return[{...edge,routing,...routeEdge(source,target,routing,{center})}]});
  const minX=Math.min(0,...nodes.map(node=>node.x))-64,minY=Math.min(0,...nodes.map(node=>node.y))-64,maxX=Math.max(960,...nodes.map(node=>node.x+node.width))+64,maxY=Math.max(650,...nodes.map(node=>node.y+node.height))+64;
  return{instanceId:instance.id,layout,nodes,edges,tokens:sceneTokens(definition,instance,nodes),bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},viewport:options.viewport??null};
}

export function fitScene(scene,viewport,padding=72){
  const zoom=clamp(Math.min((viewport.width-padding*2)/scene.bounds.width,(viewport.height-padding*2)/scene.bounds.height),.12,2.5);
  return{zoom,panX:(viewport.width-scene.bounds.width*zoom)/2-scene.bounds.x*zoom,panY:(viewport.height-scene.bounds.height*zoom)/2-scene.bounds.y*zoom};
}
