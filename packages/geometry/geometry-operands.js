import {evaluateMathExpression,parsePlotExpression,samplePlotExpression} from '../structure-engine/plotting.js';
import {meshSurfaceArea,meshVolume,polygonArea2d,tetrahedronVolume,triangleArea3d} from './geometric-measurements.js';

const point=value=>value&&[value.x,value.y,value.z??0].every(Number.isFinite)?{x:Number(value.x),y:Number(value.y),z:Number(value.z??0)}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0),(a?.z??0)-(b?.z??0));
const pointLike=ref=>['slot','motion','coordinate'].includes(ref?.type);
const refsFor=primitive=>primitive?.operandRefs?.length?primitive.operandRefs:primitive?.pointRefs??[];

export function resolveGeometryPoint(ref,{definition,instance,evaluatePlotPoint}={}){
  if(ref?.type==='coordinate')return point(ref);
  if(ref?.type==='slot')return point(definition?.slots?.find(item=>item.id===ref.id)?.semanticCoordinate);
  if(ref?.type==='motion'){
    const motion=instance?.motionPoints?.find(item=>item.id===ref.id),plot=instance?.plotExpressions?.find(item=>item.id===motion?.plotId);
    if(!motion||!plot||!evaluatePlotPoint)return null;
    try{return point(evaluatePlotPoint(plot.source,Number(motion.current??motion.start??0)))}catch{return null}
  }
  return null;
}

export function geometryOperandsFromRefs(refs=[],context={}){
  return refs.flatMap(ref=>{
    if(pointLike(ref))return[{kind:'point',ref:{...ref}}];
    if(ref?.type==='geometry'){
      const primitive=context.instance?.geometryPrimitives?.find(item=>item.id===ref.id);
      return primitive?[{kind:primitive.kind==='line'?'line':primitive.kind,ref:{type:'geometry',id:ref.id},primitive}]:[];
    }
    if(ref?.type==='plot'){
      const plot=context.instance?.plotExpressions?.find(item=>item.id===ref.id);if(!plot)return[];
      try{return[{kind:parsePlotExpression(plot.source).kind==='surface'?'surface':'curve',ref:{type:'plot',id:ref.id},plot}]}catch{return[]}
    }
    return[];
  });
}

export function geometryOperandsFromSelection(selection=[],context={}){
  const refs=[...selection].flatMap(key=>{
    const separator=String(key).indexOf(':');if(separator<1)return[];
    const type=String(key).slice(0,separator),id=String(key).slice(separator+1);
    return['slot','motion','geometry','plot'].includes(type)?[{type,id}]:[];
  });
  return geometryOperandsFromRefs(refs,context);
}

export function geometrySelectionSummary(operands=[]){
  const counts={point:0,motion:0,line:0,curve:0,surface:0};
  for(const operand of operands){if(operand.kind==='point')counts[operand.ref.type==='motion'?'motion':'point']++;else if(operand.kind in counts)counts[operand.kind]++}
  const labels={point:'点',motion:'动点',line:'直线',curve:'曲线',surface:'曲面'};
  return Object.entries(counts).filter(([,count])=>count).map(([kind,count])=>`${count} ${labels[kind]}`).join(' · ')||'尚未选择几何对象';
}

function linePoints(operand,context,seen=new Set()){
  const primitive=operand.primitive??context.instance?.geometryPrimitives?.find(item=>item.id===operand.ref?.id);if(!primitive||primitive.kind!=='line'||seen.has(primitive.id))return null;
  seen.add(primitive.id);const refs=refsFor(primitive).filter(pointLike).slice(0,2),points=refs.map(ref=>resolveGeometryPoint(ref,context));return points.every(Boolean)?points:null;
}

function curvePolyline(operand){
  const plot=operand.plot;if(!plot)return null;
  try{const parsed=parsePlotExpression(plot.source);if(parsed.kind==='surface')return null;const range=plot.rangeMode==='manual'?plot.range:plot.range??parsed.range,sampled=samplePlotExpression(plot.source,{samples:720,range}),segments=sampled.segments.filter(segment=>segment.length>1);if(segments.length!==1)return null;return segments[0].map(point)}catch{return null}
}

function scaleTolerance(polylines){const points=polylines.flat(),scale=Math.max(1,...points.map(value=>Math.hypot(value.x,value.y,value.z)));return Math.max(1e-5,scale*2e-3)}

function stitchBoundary(polylines=[]){
  if(!polylines.length)return null;const tolerance=scaleTolerance(polylines),remaining=polylines.map(line=>line.filter(Boolean));let chain=remaining.shift();if(distance(chain[0],chain.at(-1))<=tolerance)return remaining.length?null:chain;
  while(remaining.length){const end=chain.at(-1);let match=-1,reverse=false;for(let index=0;index<remaining.length;index++){if(distance(end,remaining[index][0])<=tolerance){match=index;break}if(distance(end,remaining[index].at(-1))<=tolerance){match=index;reverse=true;break}}if(match<0)return null;let next=remaining.splice(match,1)[0];if(reverse)next=next.reverse();chain.push(...next.slice(1))}
  return chain.length>=3&&distance(chain[0],chain.at(-1))<=tolerance?chain:null;
}

function coplanar(points=[]){
  if(points.length<4)return true;const a=points[0];let normal=null;for(let i=1;i<points.length-1&&!normal;i++){const b=points[i],c=points[i+1],ab={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},ac={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},candidate={x:ab.y*ac.z-ab.z*ac.y,y:ab.z*ac.x-ab.x*ac.z,z:ab.x*ac.y-ab.y*ac.x},length=Math.hypot(candidate.x,candidate.y,candidate.z);if(length>1e-9)normal={x:candidate.x/length,y:candidate.y/length,z:candidate.z/length}}
  if(!normal)return false;const scale=Math.max(1,...points.map(value=>distance(value,a)));return points.every(value=>Math.abs((value.x-a.x)*normal.x+(value.y-a.y)*normal.y+(value.z-a.z)*normal.z)<=scale*1e-6);
}

function surfaceMesh(operand){
  const plot=operand.plot;if(!plot)return null;let parsed;try{parsed=parsePlotExpression(plot.source)}catch{return null}if(parsed.kind!=='surface')return null;
  const type=parsed.primitive?.type,closed=['sphere','torus'].includes(type),ranges=parsed.ranges;if(!ranges)return{closed:false,triangles:[],type};
  const uSteps=type==='sphere'?64:56,vSteps=type==='sphere'?32:40,evaluate=(u,v)=>point({x:evaluateMathExpression(parsed.expressions.x,{u,v}),y:evaluateMathExpression(parsed.expressions.y,{u,v}),z:evaluateMathExpression(parsed.expressions.z,{u,v})}),grid=[];
  for(let i=0;i<=uSteps;i++){const u=ranges.u[0]+(ranges.u[1]-ranges.u[0])*i/uSteps,row=[];for(let j=0;j<=vSteps;j++){const v=ranges.v[0]+(ranges.v[1]-ranges.v[0])*j/vSteps;row.push(evaluate(u,v))}grid.push(row)}
  const triangles=[];for(let i=0;i<uSteps;i++)for(let j=0;j<vSteps;j++){const a=grid[i][j],b=grid[i+1][j],c=grid[i][j+1],d=grid[i+1][j+1];triangles.push([a,b,c],[b,d,c])}
  return{closed,triangles,type};
}

function pointOperands(operands,context){return operands.filter(item=>item.kind==='point').map(item=>resolveGeometryPoint(item.ref,context))}

export function resolveGeometryMeasurement(kind,operands=[],context={}){
  const dimension=context.dimension??context.instance?.parameters?.dimension??'2d',points=pointOperands(operands,context);
  if(kind==='line'){
    const enabled=operands.length===2&&operands.every(item=>item.kind==='point')&&points.every(Boolean);return{enabled,reason:enabled?'':'连接直线需要恰好两个点或动点',value:enabled?distance(points[0],points[1]):null,points:enabled?points:[]};
  }
  if(kind==='area'){
    if(operands.length===1&&operands[0].kind==='surface'){const mesh=surfaceMesh(operands[0]);if(!mesh?.closed)return{enabled:false,reason:'该曲面为开放/无限曲面，当前没有有限面积',value:null,points:[]};return{enabled:true,reason:'',value:meshSurfaceArea(mesh.triangles),triangles:mesh.triangles,points:[]}}
    if(operands.length>=3&&operands.every(item=>item.kind==='point')&&points.every(Boolean)){if(dimension==='3d'&&!coplanar(points))return{enabled:false,reason:'所选点不共面，不能构成单一面积',value:null,points};return{enabled:true,reason:'',value:dimension==='3d'?triangleArea3d(points):polygonArea2d(points),points}}
    if(operands.length&&operands.every(item=>['line','curve'].includes(item.kind))){const polylines=[];for(const operand of operands){const line=operand.kind==='line'?linePoints(operand,context):curvePolyline(operand);if(!line)return{enabled:false,reason:'当前所选线条没有形成闭合边界',value:null,points:[]};polylines.push(line)}const boundary=stitchBoundary(polylines);if(!boundary)return{enabled:false,reason:'当前所选线条没有形成闭合边界',value:null,points:[]};return{enabled:true,reason:'',value:dimension==='3d'?triangleArea3d(boundary):polygonArea2d(boundary),points:boundary}}
    return{enabled:false,reason:'需要至少三个点、一个闭合二维边界或一个可计算曲面',value:null,points:[]};
  }
  if(kind==='volume'){
    if(dimension!=='3d')return{enabled:false,reason:'体积只适用于三维空间',value:null,points:[]};
    if(operands.length===1&&operands[0].kind==='surface'){const mesh=surfaceMesh(operands[0]);if(!mesh?.closed)return{enabled:false,reason:'所选曲面没有形成闭合三维边界',value:null,points:[]};return{enabled:true,reason:'',value:meshVolume(mesh.triangles),triangles:mesh.triangles,points:[]}}
    if(operands.length===4&&operands.every(item=>item.kind==='point')&&points.every(Boolean)){const value=tetrahedronVolume(points),enabled=value>1e-10;return{enabled,reason:enabled?'':'四个点共面，不能形成体积',value:enabled?value:null,points}}
    return{enabled:false,reason:'需要四个非共面点或一个闭合三维曲面',value:null,points:[]};
  }
  return{enabled:false,reason:`不支持的几何测量 ${kind}`,value:null,points:[]};
}

export function geometryOperationAvailability(operands=[],context={}){
  const line=resolveGeometryMeasurement('line',operands,context),area=resolveGeometryMeasurement('area',operands,context),volume=resolveGeometryMeasurement('volume',operands,context);
  return{line:line.enabled,area:area.enabled,volume:volume.enabled,reasons:{line:line.reason,area:area.reason,volume:volume.reason},measurements:{line,area,volume}};
}

export function geometryOperandRefs(operands=[]){return operands.map(item=>({...item.ref}))}
