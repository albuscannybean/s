import {geometryOperandsFromRefs,resolveGeometryMeasurement,resolveGeometryPoint} from './geometry-operands.js';

const uid=()=>globalThis.crypto?.randomUUID?.()??`geometry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createGeometryPrimitive(kind,operandRefs,{id=uid(),color='#355f78',width=2,fill='rgba(53,95,120,.14)'}={}){
  if(!['line','area','volume'].includes(kind))throw new Error(`Unsupported geometry primitive: ${kind}`);
  const refs=structuredClone(operandRefs??[]),pointRefs=refs.filter(ref=>['slot','motion','coordinate'].includes(ref.type));if(kind==='line'&&pointRefs.length!==2)throw new Error('line requires exactly 2 point references');if(!refs.length)throw new Error(`${kind} requires geometry operands`);
  return{id,kind,operandRefs:refs,pointRefs,style:{color,width,fill},visible:true,createdAt:new Date().toISOString()};
}

export function evaluateGeometryPrimitive(primitive,context={}){
  const refs=primitive.operandRefs?.length?primitive.operandRefs:primitive.pointRefs??[],operands=geometryOperandsFromRefs(refs,context),measurement=resolveGeometryMeasurement(primitive.kind,operands,context);
  return{...primitive,points:measurement.points??[],triangles:measurement.triangles??[],value:measurement.value,valid:measurement.enabled,reason:measurement.reason};
}

export function buildGeometryPrimitiveScene(instance,definition,{projectCoordinate,evaluatePlotPoint}={}){
  const result=[];
  for(const primitive of instance?.geometryPrimitives??[]){
    if(primitive.visible===false||instance.objectVisibility?.[`geometry:${primitive.id}`]===false)continue;
    const evaluated=evaluateGeometryPrimitive(primitive,{instance,definition,evaluatePlotPoint});if(!evaluated.valid)continue;
    const projected=evaluated.points.map(value=>projectCoordinate(value,instance)),style=primitive.style??{},common={primitiveId:primitive.id,kind:primitive.kind,value:evaluated.value,stroke:style.color??'#355f78','stroke-width':style.width??2,'vector-effect':'non-scaling-stroke'};
    if(primitive.kind==='line'){const [a,b]=projected;result.push({...common,type:'line',className:'geometry-primitive geometry-line',x1:a.x,y1:a.y,x2:b.x,y2:b.y,fill:'none'})}
    else if(projected.length>=3){const points=projected.map(value=>`${value.x},${value.y}`).join(' ');result.push({...common,type:'polygon',className:`geometry-primitive geometry-${primitive.kind}`,points,fill:style.fill??'rgba(53,95,120,.14)'})}
  }
  return result;
}

export {resolveGeometryPoint};
