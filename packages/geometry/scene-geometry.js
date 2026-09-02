import {ensureStructureView,modularAngle} from '../structure-engine/structure-view.js';
import {resolveRelationStyle} from '../structure-engine/relation-style-resolver.js';
import {evaluatePlotPoint,parsePlotExpression,samplePlotExpressionCached} from '../structure-engine/plotting.js';
import {measureDefinitionNodes} from './node-measurement.js';
import {buildGeometryPrimitiveScene} from './geometry-primitives.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const DEFAULT_NODE_SIZE=Object.freeze({width:188,height:92});
const measured=(sizes,slot,fallback=DEFAULT_NODE_SIZE)=>sizes?.get(slot.id)??fallback;

export function estimateRelationLabelWidth(label){
  const characters=Array.from(String(label??''));
  const textWidth=characters.reduce((width,char)=>width+(/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(char)?11:/[A-ZMW@#%]/.test(char)?8:6.5),0);
  return clamp(Math.ceil(textWidth)+18,36,260);
}

const hash=value=>{let result=2166136261;for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619)}return result>>>0};
const nodeGrammar=(definition,slot,shape='roundedRect')=>{
  const layout=definition.layout?.type??'grid',id=definition.id??'';
  if(id==='builtin:lmn-432')return{shape:'roundedRect',visualKind:`lmn-${String(slot.semanticCoordinate?.column??'L').toLowerCase()}`};
  if(layout==='force')return{shape:'pill',visualKind:'graph-node'};
  if(id.includes('boolean-algebra'))return{shape:'pill',visualKind:'boolean-node'};
  if(layout==='coordinate')return{shape:'circle',visualKind:'coordinate-point'};
  if(layout==='matrix')return{shape:'rect',visualKind:'matrix-cell'};
  if(layout==='table')return{shape:'rect',visualKind:'table-cell'};
  if(layout==='venn')return{shape:'pill',visualKind:'venn-region'};
  if(layout==='radial')return{shape:'circle',visualKind:slot.role==='vertex'?'polygon-vertex':'cyclic-node'};
  if(layout==='hasse')return{shape:'pill',visualKind:'hasse-node'};
  if(layout==='tree')return{shape:'pill',visualKind:'tree-node'};
  return{shape:slot.visual?.shape??shape,visualKind:'generic-node'};
};

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

export function routeEdge(source,target,style='straight',options={}){
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
    const radius=Math.max(20,Math.hypot(start.x-center.x,start.y-center.y),Math.hypot(end.x-start.x,end.y-start.y)/2);
    const sweep=((start.x-center.x)*(end.y-center.y)-(start.y-center.y)*(end.x-center.x))>=0?1:0;
    return{start,end,points:[start,end],arc:{radius,sweep,largeArc:0},path:`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`};
  }
  const dx=end.x-start.x,dy=end.y-start.y,horizontal=Math.abs(dx)>=Math.abs(dy),bend=clamp((horizontal?Math.abs(dx):Math.abs(dy))*.42,36,180);
  const c1=horizontal?{x:start.x+Math.sign(dx||1)*bend,y:start.y}:{x:start.x,y:start.y+Math.sign(dy||1)*bend};
  const c2=horizontal?{x:end.x-Math.sign(dx||1)*bend,y:end.y}:{x:end.x,y:end.y-Math.sign(dy||1)*bend};
  return{start,end,points:[start,c1,c2,end],path:`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`};
}

function gridLayout(definition,options={},sizes){
  const slots=definition.slots,columns=options.columns??Math.max(1,Math.ceil(Math.sqrt(slots.length))),gapX=options.gapX??56,gapY=options.gapY??32,colWidths=Array(columns).fill(0),rowHeights=[];
  slots.forEach((slot,index)=>{const size=measured(sizes,slot,{width:options.width??DEFAULT_NODE_SIZE.width,height:options.height??DEFAULT_NODE_SIZE.height}),col=index%columns,row=Math.floor(index/columns);colWidths[col]=Math.max(colWidths[col],size.width);rowHeights[row]=Math.max(rowHeights[row]??0,size.height)});
  const xAt=col=>(options.x??96)+colWidths.slice(0,col).reduce((sum,value)=>sum+value+gapX,0),yAt=row=>(options.y??116)+rowHeights.slice(0,row).reduce((sum,value)=>sum+value+gapY,0);
  return slots.map((slot,index)=>{const size=measured(sizes,slot),col=index%columns,row=Math.floor(index/columns);return{...slot,x:xAt(col)+(colWidths[col]-size.width)/2,y:yAt(row),...size,...nodeGrammar(definition,slot,slot.visual?.shape??'roundedRect')}});
}

function manualLayout(definition,sizes){const positions=definition.layout?.positions??{};return definition.slots.map((slot,index)=>{const position=positions[slot.id]??{},size=measured(sizes,slot),width=Number(position.width??size.width),height=Number(position.height??size.height);return{...slot,x:Number(position.x??96+(index%3)*(width+56)),y:Number(position.y??116+Math.floor(index/3)*(height+32)),...size,width,height,...nodeGrammar(definition,slot,slot.visual?.shape??'roundedRect')}})}

function columnsLayout(definition,sizes){
  const columns=definition.layout?.columns??['L','M','N'],xStart=100,gap=94,maxWidth=Math.max(208,...definition.slots.map(slot=>measured(sizes,slot).width)),maxHeight=Math.max(104,...definition.slots.map(slot=>measured(sizes,slot).height));
  return definition.slots.map(slot=>{
    const column=slot.semanticCoordinate?.column??columns[0],columnIndex=Math.max(0,columns.indexOf(column)),order=(slot.semanticCoordinate?.order??slot.semanticCoordinate?.layer??1)-1,size=measured(sizes,slot);
    return{...slot,x:xStart+columnIndex*(maxWidth+gap)+(maxWidth-size.width)/2,y:150+order*(maxHeight+28),...size,...nodeGrammar(definition,slot),column};
  });
}

export function lmnSemanticCenters({startY=170,gapY=132}={}){
  const L=Array.from({length:4},(_,index)=>startY+index*gapY),M=L.slice(0,3).map((value,index)=>(value+L[index+1])/2),N=M.slice(0,2).map((value,index)=>(value+M[index+1])/2);return{L,M,N};
}

function lmnSemanticLayout(definition,sizes){
  const columns=['L','M','N'],centers=lmnSemanticCenters({startY:Number(definition.layout?.startY??170),gapY:Number(definition.layout?.gapY??132)}),xStart=92,gap=92,maxWidth=Math.max(216,...definition.slots.map(slot=>measured(sizes,slot).width));
  return definition.slots.map(slot=>{const column=slot.semanticCoordinate?.column??'L',columnIndex=columns.indexOf(column),order=Math.max(0,Number(slot.semanticCoordinate?.order??slot.semanticCoordinate?.layer??1)-1),centerY=centers[column]?.[order]??centers.L[order]??170,size=measured(sizes,slot);return{...slot,x:xStart+Math.max(0,columnIndex)*(maxWidth+gap)+(maxWidth-size.width)/2,y:centerY-size.height/2,...size,...nodeGrammar(definition,slot),column,semanticCenterY:centerY}});
}

function radialLayout(definition,instance){
  const count=Math.max(1,definition.slots.length),center={x:500,y:390},view=ensureStructureView(instance),isModular=definition.slots.some(slot=>slot.semanticCoordinate?.modularIndex!=null),chart=isModular&&view.displayMode==='chart',radius=Number(instance.parameters?.radius??(chart?286:count>16?270:225)),size=chart?{width:132,height:92}:{width:count>18?60:count>12?70:82,height:count>18?60:count>12?70:82};
  return definition.slots.map((slot,index)=>{const modularIndex=slot.semanticCoordinate?.modularIndex??index,degrees=isModular?modularAngle(modularIndex,count,view):(slot.semanticCoordinate?.angle??index*360/count)-90,angle=degrees*Math.PI/180;return{...slot,x:center.x+radius*Math.cos(angle)-size.width/2,y:center.y+radius*Math.sin(angle)-size.height/2,width:size.width,height:size.height,...nodeGrammar(definition,slot,chart?'roundedRect':'circle'),visualKind:chart?'modular-chart-cell':nodeGrammar(definition,slot,'circle').visualKind,displayMode:view.displayMode,angleDegrees:degrees};});
}

function layeredLayout(definition,{horizontal=false,compact=false,sizes=null,layoutDesign={}}={}){
  const groups=new Map();
  for(const slot of definition.slots){const layer=Number(slot.semanticCoordinate?.rank??slot.semanticCoordinate?.layer??0);if(!groups.has(layer))groups.set(layer,[]);groups.get(layer).push(slot)}
  const layers=[...groups.keys()].sort((a,b)=>b-a),maxCount=Math.max(1,...[...groups.values()].map(items=>items.length)),isBoolean=String(definition.id).includes('boolean-algebra'),fallback={width:isBoolean?(maxCount>16?54:68):compact?(maxCount>10?108:132):(maxCount>10?176:188),height:isBoolean?42:compact?(maxCount>10?58:66):(maxCount>10?86:92)},automatic=layoutDesign.autoSpacing!==false,gapX=automatic?(isBoolean?(maxCount>16?10:18):(maxCount>10?18:30)):Number(layoutDesign.nodeGap??30),baseGapY=automatic?(isBoolean?62:compact?74:94):Number(layoutDesign.layerGap??94),maxLabelWidth=Math.max(0,...(definition.edges??[]).map(edge=>estimateRelationLabelWidth(edge.displayLabel??edge.label??edge.relationType))),rows=layers.map(layer=>groups.get(layer).sort((a,b)=>(a.semanticCoordinate?.order??0)-(b.semanticCoordinate?.order??0))),rowHeights=rows.map(items=>Math.max(...items.map(slot=>measured(sizes,slot,fallback).height))),maxNodeWidth=Math.max(...definition.slots.map(slot=>measured(sizes,slot,fallback).width)),minRowHeight=Math.min(...rowHeights),gapY=automatic?horizontal?Math.max(baseGapY,maxNodeWidth-minRowHeight+maxLabelWidth+36):Math.max(baseGapY,maxLabelWidth+30):baseGapY,yAt=row=>112+rowHeights.slice(0,row).reduce((sum,value)=>sum+value+gapY,0);
  return rows.flatMap((items,row)=>{const widths=items.map(slot=>measured(sizes,slot,fallback).width),total=widths.reduce((sum,value)=>sum+value,0)+(items.length-1)*gapX,start=Math.max(70,(1040-total)/2);let cursor=start;return items.map((slot,index)=>{const size=measured(sizes,slot,fallback),node={...slot,x:cursor,y:yAt(row)+(rowHeights[row]-size.height)/2,...size,...nodeGrammar(definition,slot)};cursor+=size.width+gapX;return node})});
}

function forceLayout(definition,sizes){
  const slots=definition.slots,count=Math.max(1,slots.length),center={x:520,y:370},radius=Math.max(150,Math.min(300,95+count*20)),positions=new Map(),velocity=new Map();
  for(const [index,slot] of slots.entries()){const phase=(hash(slot.id)%1000)/1000*.7,angle=index*Math.PI*2/count-Math.PI/2+phase;positions.set(slot.id,{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});velocity.set(slot.id,{x:0,y:0})}
  const edges=(definition.edges??[]).filter(edge=>positions.has(edge.sourceSlotId)&&positions.has(edge.targetSlotId));
  for(let iteration=0;iteration<180;iteration++){
    const forces=new Map(slots.map(slot=>[slot.id,{x:0,y:0}]));
    for(let left=0;left<slots.length;left++)for(let right=left+1;right<slots.length;right++){const a=positions.get(slots[left].id),b=positions.get(slots[right].id),dx=a.x-b.x,dy=a.y-b.y,distance2=Math.max(1600,dx*dx+dy*dy),distance=Math.sqrt(distance2),strength=25000/distance2,fx=dx/distance*strength,fy=dy/distance*strength;forces.get(slots[left].id).x+=fx;forces.get(slots[left].id).y+=fy;forces.get(slots[right].id).x-=fx;forces.get(slots[right].id).y-=fy}
    for(const edge of edges){const a=positions.get(edge.sourceSlotId),b=positions.get(edge.targetSlotId),dx=b.x-a.x,dy=b.y-a.y,distance=Math.max(1,Math.hypot(dx,dy)),strength=(distance-185)*.018,fx=dx/distance*strength,fy=dy/distance*strength;forces.get(edge.sourceSlotId).x+=fx;forces.get(edge.sourceSlotId).y+=fy;forces.get(edge.targetSlotId).x-=fx;forces.get(edge.targetSlotId).y-=fy}
    const cooling=1-iteration/230;
    for(const slot of slots){const point=positions.get(slot.id),force=forces.get(slot.id),speed=velocity.get(slot.id);force.x+=(center.x-point.x)*.006;force.y+=(center.y-point.y)*.006;speed.x=(speed.x+force.x)*.76*cooling;speed.y=(speed.y+force.y)*.76*cooling;point.x=clamp(point.x+speed.x,105,935);point.y=clamp(point.y+speed.y,105,650)}
  }
  return slots.map(slot=>{const point=positions.get(slot.id),size=measured(sizes,slot,{width:104,height:48});return{...slot,x:point.x-size.width/2,y:point.y-size.height/2,...size,...nodeGrammar(definition,slot)}});
}

function treeLayout(definition,options={}){
  const incoming=new Map(definition.slots.map(slot=>[slot.id,0]));for(const edge of definition.edges)incoming.set(edge.targetSlotId,(incoming.get(edge.targetSlotId)??0)+1);
  const roots=definition.slots.filter(slot=>!incoming.get(slot.id)),depth=new Map(roots.map(slot=>[slot.id,0])),queue=roots.map(slot=>slot.id);
  while(queue.length){const id=queue.shift(),level=depth.get(id);for(const edge of definition.edges.filter(item=>item.sourceSlotId===id))if(!depth.has(edge.targetSlotId)){depth.set(edge.targetSlotId,level+1);queue.push(edge.targetSlotId)}}
  const decorated={...definition,slots:definition.slots.map((slot,index)=>({...slot,semanticCoordinate:{...slot.semanticCoordinate,layer:depth.get(slot.id)??0,order:index}}))};return layeredLayout(decorated,options);
}

export function projectCoordinate(coordinate={},instance={}){
  const scale=Number(instance.parameters?.scale??40),center={x:500,y:360},x=Number(coordinate.x??0),y=Number(coordinate.y??0),z=Number(coordinate.z??0),view=ensureStructureView(instance),dimension=instance.parameters?.dimension??'2d',requested=view.camera?.projection??(dimension==='3d'?'free':'xOy'),projection=dimension==='2d'&&requested==='free'?'xOy':requested;
  if(projection==='xOy')return{x:center.x+x*scale,y:center.y-y*scale};
  if(projection==='yOz')return{x:center.x+y*scale,y:center.y-z*scale};
  if(projection==='xOz')return{x:center.x+x*scale,y:center.y-z*scale};
  const yaw=Number(view.camera?.yaw??42)*Math.PI/180,pitch=Number(view.camera?.pitch??28)*Math.PI/180,horizontal=x*Math.cos(yaw)-y*Math.sin(yaw),depth=x*Math.sin(yaw)+y*Math.cos(yaw),vertical=z*Math.cos(pitch)-depth*Math.sin(pitch);
  return{x:center.x+horizontal*scale,y:center.y-vertical*scale,depth:depth*Math.cos(pitch)+z*Math.sin(pitch)};
}
function coordinateLayout(definition,instance){return definition.slots.map(slot=>{const size=slot.role==='origin'?8:slot.role==='basis'?11:10,point=projectCoordinate(slot.semanticCoordinate,instance);return{...slot,x:point.x-size/2,y:point.y-size/2,width:size,height:size,...nodeGrammar(definition,slot,'circle')}})}

function tableLayout(definition){
  const n=Math.max(1,Math.round(Math.sqrt(definition.slots.length))),size=54,x=170,y=116;return definition.slots.map((slot,index)=>({...slot,x:x+((slot.semanticCoordinate?.col??index%n)+1)*size,y:y+((slot.semanticCoordinate?.row??Math.floor(index/n))+1)*size,width:size,height:size,...nodeGrammar(definition,slot,'rect')}));
}

function matrixLayout(definition){
  const rows=Math.max(1,Number(definition.runtimeMetadata?.matrix?.rows??Math.max(...definition.slots.map(slot=>Number(slot.semanticCoordinate?.row)||1)))),columns=Math.max(1,Number(definition.runtimeMetadata?.matrix?.columns??Math.max(...definition.slots.map(slot=>Number(slot.semanticCoordinate?.col)||1)))),width=92,height=62,gap=5,totalWidth=columns*(width+gap)-gap,x=Math.max(120,(1040-totalWidth)/2),y=132;return definition.slots.map((slot,index)=>{const row=Math.max(1,Number(slot.semanticCoordinate?.row)||Math.floor(index/columns)+1),col=Math.max(1,Number(slot.semanticCoordinate?.col)||index%columns+1);return{...slot,x:x+(col-1)*(width+gap),y:y+(row-1)*(height+gap),width,height,...nodeGrammar(definition,slot,'rect')}})
}

function vennLayout(definition){
  const two={"A-only":[330,310],intersection:[478,310],"B-only":[626,310]},three={A:[330,246],B:[628,246],C:[478,478],AB:[478,238],AC:[392,370],BC:[564,370],ABC:[478,342]},positions=Number(definition.layout?.sets)===2?two:three;
  return definition.slots.map((slot,index)=>{const point=positions[slot.id]??[360+(index%3)*130,280+Math.floor(index/3)*82],width=154,height=60;return{...slot,x:point[0]-29,y:point[1]-11,width,height,...nodeGrammar(definition,slot,'pill')}});
}

const niceStep=rough=>{const power=10**Math.floor(Math.log10(Math.max(rough,1e-9))),scaled=rough/power,factor=scaled<=1?1:scaled<=2?2:scaled<=5?5:10;return factor*power};
const tickText=value=>Math.abs(value)<1e-10?'0':Number(value.toPrecision(8)).toString();
function coordinateViewport(options,scale,center){const world=options.worldViewport;if(!world)return{xMin:-12,xMax:12,yMin:-8,yMax:8,worldLeft:center.x-12*scale,worldRight:center.x+12*scale,worldTop:center.y-8*scale,worldBottom:center.y+8*scale};return{xMin:(world.left-center.x)/scale,xMax:(world.right-center.x)/scale,yMin:(center.y-world.bottom)/scale,yMax:(center.y-world.top)/scale,worldLeft:world.left,worldRight:world.right,worldTop:world.top,worldBottom:world.bottom}}
function addCoordinateBackground(items,instance,options){
  const scale=Number(instance.parameters?.scale??40),center={x:500,y:360},dimension=instance.parameters?.dimension??'2d',view=ensureStructureView(instance),requested=view.camera?.projection??(dimension==='3d'?'free':'xOy'),projection=dimension==='2d'&&requested==='free'?'xOy':requested,zoom=Number(options.zoom??1)||1,major=niceStep(70/(scale*zoom)),minor=major/(scale*zoom*major>125?5:2),visible=coordinateViewport(options,scale,center),margin=major*2,planeAxes=projection==='yOz'?['y','z']:projection==='xOz'?['x','z']:['x','y'],point=(a,b)=>({[planeAxes[0]]:a,[planeAxes[1]]:b});
  if(projection!=='free'){
    const aStart=Math.floor((visible.xMin-margin)/minor)*minor,aEnd=Math.ceil((visible.xMax+margin)/minor)*minor,bStart=Math.floor((visible.yMin-margin)/minor)*minor,bEnd=Math.ceil((visible.yMax+margin)/minor)*minor;
    for(let value=aStart,index=0;value<=aEnd+minor/2&&index<800;value+=minor,index++){const start=projectCoordinate(point(value,bStart),instance),end=projectCoordinate(point(value,bEnd),instance),isMajor=Math.abs(value/major-Math.round(value/major))<1e-7;items.push({type:'line',className:Math.abs(value)<1e-9?'coordinate-axis':isMajor?'coordinate-grid coordinate-grid-major':'coordinate-grid',x1:start.x,y1:start.y,x2:end.x,y2:end.y});if(isMajor&&Math.abs(value)>1e-9)items.push({type:'text',className:'coordinate-tick-label',x:start.x,y:center.y+18,text:tickText(value)})}
    for(let value=bStart,index=0;value<=bEnd+minor/2&&index<800;value+=minor,index++){const start=projectCoordinate(point(aStart,value),instance),end=projectCoordinate(point(aEnd,value),instance),isMajor=Math.abs(value/major-Math.round(value/major))<1e-7;items.push({type:'line',className:Math.abs(value)<1e-9?'coordinate-axis':isMajor?'coordinate-grid coordinate-grid-major':'coordinate-grid',x1:start.x,y1:start.y,x2:end.x,y2:end.y});if(isMajor&&Math.abs(value)>1e-9)items.push({type:'text',className:'coordinate-tick-label',x:center.x-18,y:start.y+4,text:tickText(value)})}
    const aLabel=projectCoordinate(point(visible.xMax+margin*.3,0),instance),bLabel=projectCoordinate(point(0,visible.yMax+margin*.3),instance);items.push({type:'text',className:'coordinate-axis-label',x:aLabel.x,y:aLabel.y-8,text:planeAxes[0]},{type:'text',className:'coordinate-axis-label',x:bLabel.x+8,y:bLabel.y,text:planeAxes[1]},{type:'text',className:'coordinate-origin-label',x:center.x-15,y:center.y+18,text:'O'});
  }else{
    const extent=Math.max(8,Math.ceil(Math.max(Math.abs(visible.xMin),Math.abs(visible.xMax),Math.abs(visible.yMin),Math.abs(visible.yMax)))+3),gridStep=Math.max(major,1),axisExtent=extent+gridStep;
    for(let value=-extent,index=0;value<=extent&&index<180;value+=gridStep,index++){const x1=projectCoordinate({x:-extent,y:value,z:0},instance),x2=projectCoordinate({x:extent,y:value,z:0},instance),y1=projectCoordinate({x:value,y:-extent,z:0},instance),y2=projectCoordinate({x:value,y:extent,z:0},instance);items.push({type:'line',className:'coordinate-grid coordinate-grid-3d',x1:x1.x,y1:x1.y,x2:x2.x,y2:x2.y},{type:'line',className:'coordinate-grid coordinate-grid-3d',x1:y1.x,y1:y1.y,x2:y2.x,y2:y2.y})}
    const axes=[['x',{x:-axisExtent},{x:axisExtent}],['y',{y:-axisExtent},{y:axisExtent}],['z',{z:-axisExtent},{z:axisExtent}]];for(const[name,start,end]of axes){const a=projectCoordinate(start,instance),b=projectCoordinate(end,instance);items.push({type:'line',className:`coordinate-axis coordinate-${name}-axis`,x1:a.x,y1:a.y,x2:b.x,y2:b.y},{type:'text',className:'coordinate-axis-label',x:b.x+8,y:b.y-8,text:name})}
    for(let value=-axisExtent;value<=axisExtent;value+=major){if(Math.abs(value)<1e-9)continue;for(const axis of['x','y','z']){const tick=projectCoordinate({[axis]:value},instance);items.push({type:'text',className:'coordinate-tick-label coordinate-tick-3d',x:tick.x+5,y:tick.y-5,text:tickText(value)})}}items.push({type:'text',className:'coordinate-origin-label',x:center.x+8,y:center.y+18,text:'O'});
  }
  instance.runtimeState??={variables:{},results:{},errors:{}};instance.runtimeState.errors??={};
  for(const[index,plot]of(instance.plotExpressions??[]).entries())try{if(plot.visible===false||instance.objectVisibility?.[`plot:${plot.id}`]===false)continue;const parsed=parsePlotExpression(plot.source),viewportRange=[visible.xMin-margin,visible.xMax+margin],range=plot.rangeMode==='manual'?plot.range:parsed.kind==='function'||(parsed.kind==='parametric'&&!['circle','ellipse','heart'].includes(parsed.primitive?.type))?viewportRange:plot.range,ranges=parsed.kind==='surface'&&parsed.primitive?.type==='paraboloid'&&plot.rangeMode!=='manual'?{u:viewportRange,v:[visible.yMin-margin,visible.yMax+margin]}:null,quality=options.interactionQuality??'full',sampled=samplePlotExpressionCached(plot.source,{range,ranges,samples:quality==='drag'?90:240,quality}),paths=sampled.segments.map(segment=>segment.filter(Boolean).map((value,pointIndex)=>{const projected=projectCoordinate(value,instance);return`${pointIndex?'L':'M'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`}).join(' ')).filter(Boolean);delete instance.runtimeState.errors[`plot:${plot.id}`];for(const d of paths)items.push({type:'path',className:`coordinate-curve${sampled.kind==='surface'?' coordinate-surface-mesh':''}`,plotId:plot.id,title:`${plot.label??'曲线'} · ${plot.source}`,d,fill:'none',stroke:plot.color??['#2f7658','#7657a8','#c8922e','#477c84'][index%4],'stroke-width':sampled.kind==='surface'?1.25:2.6,opacity:sampled.kind==='surface'?.62:1,'vector-effect':'non-scaling-stroke'})}catch(error){instance.runtimeState.errors[`plot:${plot.id}`]=error.message}
  for(const motion of instance.motionPoints??[])try{if(instance.objectVisibility?.[`motion:${motion.id}`]===false)continue;const plot=(instance.plotExpressions??[]).find(item=>item.id===motion.plotId);if(!plot)throw new Error('动点引用的曲线不存在');const position=projectCoordinate(evaluatePlotPoint(plot.source,Number(motion.current??motion.start??0)),instance);delete instance.runtimeState.errors[`motion:${motion.id}`];items.push({type:'circle',className:`coordinate-motion-point${motion.playing?' playing':''}`,motionId:motion.id,title:`${motion.label??'动点'} · t=${tickText(Number(motion.current??0))}`,cx:position.x,cy:position.y,r:5,fill:motion.color??'#d65b45',stroke:'#222','stroke-width':1.4,'vector-effect':'non-scaling-stroke'})}catch(error){instance.runtimeState.errors[`motion:${motion.id}`]=error.message}
}

function sceneBackground(definition,instance,options={}){
  const layout=definition.layout?.type,items=[];
  if(layout==='lmn-semantic'){
    const arrangement=ensureStructureView(instance).arrangement??'horizontal-forward',vertical=arrangement.startsWith('vertical'),reverse=arrangement.endsWith('reverse'),columns=[['L','Layer · 本体层级',204],['M','Mediation · 中介转换',506],['N','Feedback · 双向反馈',808]];
    for(const[column,label,position]of columns){const axisPosition=reverse?1012-position:position;if(vertical)items.push({type:'text',className:`lmn-column-title lmn-${column.toLowerCase()}`,x:42,y:axisPosition-110,text:label});else items.push({type:'text',className:`lmn-column-title lmn-${column.toLowerCase()}`,x:axisPosition,y:82,text:label});if(column==='L'&&!vertical)items.push({type:'line',className:'lmn-ontology-spine',x1:axisPosition,y1:132,x2:axisPosition,y2:690})}
  }
  if(layout==='venn'){
    const names=instance.parameters?.setLabels??(Number(definition.layout?.sets)===2?['A','B']:['A','B','C']),sets=Number(definition.layout?.sets)===2?[{x:430,y:340,label:names[0]},{x:610,y:340,label:names[1]}]:[{x:420,y:300,label:names[0]},{x:600,y:300,label:names[1]},{x:510,y:450,label:names[2]}];
    for(const [index,set] of sets.entries()){items.push({type:'circle',className:`venn-set venn-set-${index+1}`,cx:set.x,cy:set.y,r:178});items.push({type:'text',className:'venn-set-label',x:set.x+(index===0?-125:sets.length===2?125:0),y:set.y-145,text:set.label})}
  }
  if(layout==='coordinate')addCoordinateBackground(items,instance,options);
  if(layout==='table'){
    const n=Math.max(1,Math.round(Math.sqrt(definition.slots.length))),size=54,x=170,y=116,operation=instance.parameters?.operation==='multiply-mod-n'?'×':'+';
    for(let row=0;row<=n;row++)for(let col=0;col<=n;col++)items.push({type:'rect',className:row===0||col===0?'table-header-cell':'table-grid-cell',x:x+col*size,y:y+row*size,width:size,height:size});
    items.push({type:'text',className:'table-operation-symbol',x:x+size/2,y:y+size/2+5,text:operation});
    for(let index=0;index<n;index++){items.push({type:'text',className:'table-header-label',x:x+(index+1.5)*size,y:y+size/2+5,text:String(index)});items.push({type:'text',className:'table-header-label',x:x+size/2,y:y+(index+1.5)*size+5,text:String(index)})}
  }
  if(layout==='matrix'){
    const rows=Math.max(1,Number(definition.runtimeMetadata?.matrix?.rows??1)),columns=Math.max(1,Number(definition.runtimeMetadata?.matrix?.columns??1)),width=92,height=62,gap=5,totalWidth=columns*(width+gap)-gap,x=Math.max(120,(1040-totalWidth)/2),y=132,pad=18;items.push({type:'path',className:'matrix-bracket',d:`M ${x-pad+10} ${y} L ${x-pad} ${y} L ${x-pad} ${y+rows*(height+gap)-gap} L ${x-pad+10} ${y+rows*(height+gap)-gap}`},{type:'path',className:'matrix-bracket',d:`M ${x+totalWidth+pad-10} ${y} L ${x+totalWidth+pad} ${y} L ${x+totalWidth+pad} ${y+rows*(height+gap)-gap} L ${x+totalWidth+pad-10} ${y+rows*(height+gap)-gap}`});for(let col=1;col<=columns;col++)items.push({type:'text',className:'matrix-axis-label',x:x+(col-.5)*(width+gap)-gap/2,y:y-14,text:`c${col}`});for(let row=1;row<=rows;row++)items.push({type:'text',className:'matrix-axis-label',x:x-32,y:y+(row-.5)*(height+gap)+4,text:`r${row}`})
  }
  return items;
}

function applyOffsets(nodes,instance){
  const offsets=instance.layoutState?.visualOffsets??{},positions=instance.layoutState?.nodePositions??{};
  return nodes.map(node=>{const override=positions[node.id],offset=offsets[node.id]??{};return{...node,x:override?.x??node.x+Number(offset.x??0),y:override?.y??node.y+Number(offset.y??0),width:override?.width??node.width,height:override?.height??node.height}});
}

function sceneTokens(definition,instance,nodes){
  if(definition.layout?.type!=='radial'||ensureStructureView(instance).displayMode!=='chart')return[];
  const byIndex=new Map(nodes.map(node=>[Number(node.semanticCoordinate?.modularIndex),node])),variables=instance.variables??[];
  const groups=new Map();
  for(const variable of variables){if(variable.showOnCanvas===false)continue;const value=instance.runtimeState?.results?.[variable.id]??instance.runtimeState?.variables?.[variable.id]??variable.value;if(value==null)continue;const modulus=Number(instance.parameters?.modulus??definition.slots.length)||definition.slots.length,index=((Number(value)%modulus)+modulus)%modulus;if(!groups.has(index))groups.set(index,[]);groups.get(index).push({...variable,value,index})}
  return[...groups.entries()].flatMap(([index,items])=>{const node=byIndex.get(index)??nodes[index%nodes.length],visible=items.slice(0,5);return visible.map((item,itemIndex)=>({id:item.id,label:String(item.displayName??item.label??'变量').trim()||'变量',icon:String(item.icon??'').trim(),value:item.value,index,x:node.x+8,y:node.y+31+itemIndex*28,width:Math.max(72,node.width-16),height:24,color:item.color??['#c8922e','#7657a8','#2f7658','#557c91'][itemIndex%4],stackIndex:itemIndex,stackSize:items.length,overflowCount:itemIndex===visible.length-1?Math.max(0,items.length-visible.length):0}))});
}

export function buildSceneGeometry(definition,instance={},options={}){
  const layout=definition.layout?.type??'grid',view=ensureStructureView(instance),baseAxis=['tree','hasse','layered'].includes(layout)?'vertical-reverse':['lmn-semantic','columns','timeline'].includes(layout)?'horizontal-forward':null,arrangement=view.arrangement??baseAxis,horizontalArrangement=arrangement?.startsWith('horizontal'),measurementMinimum=layout==='force'?{width:104,height:48}:String(definition.id).includes('boolean-algebra')?{width:68,height:42}:layout==='hasse'?{width:132,height:66}:DEFAULT_NODE_SIZE,sizes=measureDefinitionNodes(definition,instance,measurementMinimum);let nodes;
  if(layout==='lmn-semantic')nodes=lmnSemanticLayout(definition,sizes);
  else if(layout==='manual')nodes=manualLayout(definition,sizes);
  else if(layout==='columns')nodes=columnsLayout(definition,sizes);
  else if(layout==='radial')nodes=radialLayout(definition,instance);
  else if(layout==='force')nodes=forceLayout(definition,sizes);
  else if(layout==='hasse'||layout==='layered')nodes=layeredLayout(definition,{horizontal:horizontalArrangement,compact:layout==='hasse',sizes,layoutDesign:instance.designStyles?.layout});
  else if(layout==='tree')nodes=treeLayout(definition,{horizontal:horizontalArrangement,sizes,layoutDesign:instance.designStyles?.layout});
  else if(layout==='coordinate')nodes=coordinateLayout(definition,instance);
  else if(layout==='table')nodes=tableLayout(definition);
  else if(layout==='matrix')nodes=matrixLayout(definition);
  else if(layout==='venn')nodes=vennLayout(definition);
  else nodes=gridLayout(definition,{columns:layout==='timeline'?definition.slots.length:undefined,gapX:instance.designStyles?.layout?.autoSpacing===false?Number(instance.designStyles.layout.nodeGap??30):undefined,gapY:instance.designStyles?.layout?.autoSpacing===false?Number(instance.designStyles.layout.layerGap??32):undefined},sizes);
  if(baseAxis&&arrangement){const desiredVertical=arrangement.startsWith('vertical'),baseVertical=baseAxis.startsWith('vertical'),reverse=arrangement.endsWith('reverse');nodes=nodes.map(node=>{const centerX=node.x+node.width/2,centerY=node.y+node.height/2,u=baseVertical?-(centerY-370):centerX-520,v=baseVertical?centerX-520:centerY-370,axis=reverse?-u:u,nextCenterX=desiredVertical?520+v:520+axis,nextCenterY=desiredVertical?370+axis:370+v,width=node.width,height=node.height;return{...node,x:nextCenterX-width/2,y:nextCenterY-height/2,width,height}})}nodes=applyOffsets(nodes,instance).filter(node=>instance.objectVisibility?.[`slot:${node.id}`]!==false);const byId=new Map(nodes.map(node=>[node.id,node]));
  const center=layout==='radial'?{x:500,y:390}:undefined;
  const edges=definition.edges.flatMap(edge=>{if(instance.objectVisibility?.[`edge:${edge.id}`]===false)return[];const source=byId.get(edge.sourceSlotId),target=byId.get(edge.targetSlotId);if(!source||!target)return[];const visual=resolveRelationStyle(edge,instance,{structureDefault:definition.relationStyle??definition.visual?.relationStyle??{routing:definition.visual?.edgeRouting}}),routing=visual.routing??(layout==='radial'?'radial-arc':'straight'),coordinateEndpoints=layout==='coordinate'?{start:{x:source.x+source.width/2,y:source.y+source.height/2},end:{x:target.x+target.width/2,y:target.y+target.height/2}}:null,routed=coordinateEndpoints?{...coordinateEndpoints,points:[coordinateEndpoints.start,coordinateEndpoints.end],path:`M ${coordinateEndpoints.start.x} ${coordinateEndpoints.start.y} L ${coordinateEndpoints.end.x} ${coordinateEndpoints.end.y}`} : routeEdge(source,target,routing,{center});return[{...edge,routing,visual,...routed}]});
  const minX=Math.min(0,...nodes.map(node=>node.x))-64,minY=Math.min(0,...nodes.map(node=>node.y))-64,maxX=Math.max(960,...nodes.map(node=>node.x+node.width))+64,maxY=Math.max(650,...nodes.map(node=>node.y+node.height))+64;
  return{instanceId:instance.id,templateId:definition.id,layout,nodes,edges,geometry:layout==='coordinate'?buildGeometryPrimitiveScene(instance,definition,{projectCoordinate,evaluatePlotPoint}):[],background:sceneBackground(definition,instance,options),tokens:sceneTokens(definition,instance,nodes),bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY},viewport:options.viewport??null};
}

export function fitScene(scene,viewport,padding=72){
  const zoom=clamp(Math.min((viewport.width-padding*2)/scene.bounds.width,(viewport.height-padding*2)/scene.bounds.height),.3,2.5);
  return{zoom,panX:(viewport.width-scene.bounds.width*zoom)/2-scene.bounds.x*zoom,panY:(viewport.height-scene.bounds.height*zoom)/2-scene.bounds.y*zoom};
}
