import {createGeometryPrimitive} from '../geometry/geometry-primitives.js';

export function geometryPointRefsFromSelection(selection=[]){return[...selection].flatMap(key=>key.startsWith('slot:')?[{type:'slot',id:key.slice(5)}]:key.startsWith('motion:')?[{type:'motion',id:key.slice(7)}]:[])}

export function geometryOperationAvailability(selection=[],dimension='2d'){
  const count=geometryPointRefsFromSelection(selection).length;return{line:count>=2,area:count>=3,volume:dimension==='3d'&&count>=4,reasons:{line:count>=2?'':'至少选择两个点',area:count>=3?'':'至少选择三个点',volume:dimension!=='3d'?'体积只适用于三维空间':count>=4?'':'至少选择四个点'}};
}

export function createPrimitiveFromSelection(instance,kind,selection=[]){
  const refs=geometryPointRefsFromSelection(selection),minimum={line:2,area:3,volume:4}[kind]??Infinity;if(refs.length<minimum)throw new Error(`创建${{line:'直线',area:'面积',volume:'体积'}[kind]??kind}需要至少 ${minimum} 个点`);
  const primitive=createGeometryPrimitive(kind,refs.slice(0,kind==='line'?2:kind==='volume'?4:refs.length));instance.geometryPrimitives??=[];instance.geometryPrimitives.push(primitive);return primitive;
}
