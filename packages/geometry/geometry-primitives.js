import {measureGeometry} from './geometric-measurements.js';

const uid=()=>globalThis.crypto?.randomUUID?.()??`geometry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createGeometryPrimitive(kind,pointRefs,{id=uid(),color='#355f78',width=2,fill='rgba(53,95,120,.14)'}={}){
  if(!['line','area','volume'].includes(kind))throw new Error(`Unsupported geometry primitive: ${kind}`);
  const minimum={line:2,area:3,volume:4}[kind];if((pointRefs??[]).length<minimum)throw new Error(`${kind} requires ${minimum} point references`);
  return{id,kind,pointRefs:structuredClone(pointRefs),style:{color,width,fill},visible:true,createdAt:new Date().toISOString()};
}

export function resolveGeometryPoint(ref,{definition,instance,evaluatePlotPoint}={}){
  if(ref?.type==='coordinate')return{x:Number(ref.x??0),y:Number(ref.y??0),z:Number(ref.z??0)};
  if(ref?.type==='slot')return definition?.slots?.find(item=>item.id===ref.id)?.semanticCoordinate??null;
  if(ref?.type==='motion'){
    const motion=instance?.motionPoints?.find(item=>item.id===ref.id),plot=instance?.plotExpressions?.find(item=>item.id===motion?.plotId);
    if(!motion||!plot||!evaluatePlotPoint)return null;return evaluatePlotPoint(plot.source,Number(motion.current??motion.start??0));
  }
  return null;
}

export function evaluateGeometryPrimitive(primitive,context={}){
  const points=(primitive.pointRefs??[]).map(ref=>resolveGeometryPoint(ref,context)).filter(Boolean),dimension=context.instance?.parameters?.dimension??'2d';
  return{...primitive,points,value:measureGeometry(primitive.kind,points,dimension),valid:points.length===(primitive.pointRefs??[]).length};
}

export function buildGeometryPrimitiveScene(instance,definition,{projectCoordinate,evaluatePlotPoint}={}){
  const result=[];
  for(const primitive of instance?.geometryPrimitives??[]){
    if(primitive.visible===false||instance.objectVisibility?.[`geometry:${primitive.id}`]===false)continue;
    const evaluated=evaluateGeometryPrimitive(primitive,{instance,definition,evaluatePlotPoint});if(!evaluated.valid)continue;
    const projected=evaluated.points.map(value=>projectCoordinate(value,instance)),style=primitive.style??{},common={primitiveId:primitive.id,kind:primitive.kind,value:evaluated.value,stroke:style.color??'#355f78','stroke-width':style.width??2,'vector-effect':'non-scaling-stroke'};
    if(primitive.kind==='line'){const [a,b]=projected;result.push({...common,type:'line',className:'geometry-primitive geometry-line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,fill:'none'})}
    else{const points=projected.map(value=>`${value.x},${value.y}`).join(' ');result.push({...common,type:'polygon',className:`geometry-primitive geometry-${primitive.kind}`,points,fill:style.fill??'rgba(53,95,120,.14)'})}
  }
  return result;
}
