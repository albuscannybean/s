import {createGeometryPrimitive} from '../geometry/geometry-primitives.js';
import {geometryOperandRefs,geometryOperandsFromSelection,geometryOperationAvailability as resolveAvailability} from '../geometry/geometry-operands.js';

export function geometryPointRefsFromSelection(selection=[]){return[...selection].flatMap(key=>key.startsWith('slot:')?[{type:'slot',id:key.slice(5)}]:key.startsWith('motion:')?[{type:'motion',id:key.slice(7)}]:[])}

export function geometryOperationAvailability(selection=[],options='2d'){
  const context=typeof options==='string'?{dimension:options}:options,operands=geometryOperandsFromSelection(selection,context);return resolveAvailability(operands,context);
}

export function createPrimitiveFromSelection(instance,kind,selection=[],context={}){
  const resolvedContext={...context,instance},operands=geometryOperandsFromSelection(selection,resolvedContext),availability=resolveAvailability(operands,resolvedContext),measurement=availability.measurements[kind],legacyLineWithoutCoordinates=kind==='line'&&!context.definition&&operands.length===2&&operands.every(item=>item.kind==='point');if(!measurement?.enabled&&!legacyLineWithoutCoordinates)throw new Error(measurement?.reason??`无法创建 ${kind}`);
  const refs=geometryOperandRefs(kind==='line'?operands.slice(0,2):operands),primitive=createGeometryPrimitive(kind,refs);instance.geometryPrimitives??=[];instance.geometryPrimitives.push(primitive);return primitive;
}

export {geometryOperandsFromSelection};
