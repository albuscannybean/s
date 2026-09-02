import {evaluateGeometryPrimitive} from '../geometry/geometry-primitives.js';

const visible=(instance,key,fallback=true)=>instance.objectVisibility?.[key]??fallback;
const setVisibility=(instance,key,value)=>{instance.objectVisibility??={};instance.objectVisibility[key]=Boolean(value)};

function provider(kind,items,methods={}){return{kind,list:()=>items(),get:id=>items().find(item=>item.id===id),...methods}}

export function getVariableProviders(template,instance,definition,{evaluatePlotPoint}={}){
  const removeBy=(field,id)=>{instance[field]=(instance[field]??[]).filter(item=>item.id!==id)};
  return[
    provider('variable',()=>instance.variables??[],{
      rename:(id,name)=>{const item=(instance.variables??[]).find(value=>value.id===id);if(item)item.label=name},update:(id,patch)=>Object.assign((instance.variables??[]).find(value=>value.id===id)??{},patch),setVisible:(id,value)=>{const item=(instance.variables??[]).find(entry=>entry.id===id);if(item)item.showOnCanvas=Boolean(value)},remove:id=>removeBy('variables',id),evaluate:id=>instance.runtimeState?.results?.[id]??instance.runtimeState?.variables?.[id],describe:item=>item.kind==='derived'?item.formula:String(item.value??'')
    }),
    provider('point',()=>definition.slots.filter(item=>item.id!=='origin'&&item.role!=='vector-end'&&item.semanticCoordinate&&'x'in item.semanticCoordinate),{
      rename:(id,name)=>{instance.overrides.slotPatches[id]={...(instance.overrides.slotPatches[id]??{}),label:name}},setVisible:(id,value)=>setVisibility(instance,`slot:${id}`,value),remove:id=>{instance.overrides.removedSlotIds.push(id)},evaluate:id=>definition.slots.find(item=>item.id===id)?.semanticCoordinate,describe:item=>coordinateText(item.semanticCoordinate)
    }),
    provider('vector',()=>definition.slots.filter(item=>item.role==='vector-end'&&item.semanticCoordinate&&'x'in item.semanticCoordinate),{
      rename:(id,name)=>{instance.overrides.slotPatches[id]={...(instance.overrides.slotPatches[id]??{}),label:name}},setVisible:(id,value)=>setVisibility(instance,`slot:${id}`,value),remove:id=>{instance.overrides.removedSlotIds.push(id)},evaluate:id=>definition.slots.find(item=>item.id===id)?.semanticCoordinate,describe:item=>coordinateText(item.semanticCoordinate)
    }),
    provider('plot',()=>instance.plotExpressions??[],{
      rename:(id,name)=>{const item=(instance.plotExpressions??[]).find(value=>value.id===id);if(item)item.label=name},update:(id,patch)=>Object.assign((instance.plotExpressions??[]).find(value=>value.id===id)??{},patch),setVisible:(id,value)=>setVisibility(instance,`plot:${id}`,value),remove:id=>removeBy('plotExpressions',id),evaluate:()=>null,describe:item=>item.source
    }),
    provider('motion',()=>instance.motionPoints??[],{
      rename:(id,name)=>{const item=(instance.motionPoints??[]).find(value=>value.id===id);if(item)item.label=name},update:(id,patch)=>Object.assign((instance.motionPoints??[]).find(value=>value.id===id)??{},patch),setVisible:(id,value)=>setVisibility(instance,`motion:${id}`,value),remove:id=>removeBy('motionPoints',id),evaluate:id=>(instance.motionPoints??[]).find(item=>item.id===id)?.current,describe:item=>`t = ${Number(item.current??item.start??0).toPrecision(4)}`
    }),
    provider('geometry',()=>instance.geometryPrimitives??[],{
      setVisible:(id,value)=>setVisibility(instance,`geometry:${id}`,value),remove:id=>removeBy('geometryPrimitives',id),evaluate:id=>evaluateGeometryPrimitive((instance.geometryPrimitives??[]).find(item=>item.id===id)??{pointRefs:[]},{instance,definition,evaluatePlotPoint}).value,describe:item=>`${item.pointRefs?.length??0} 个点`
    })
  ];
}

export function listRegisteredVariables(template,instance,definition,options={}){
  return getVariableProviders(template,instance,definition,options).flatMap(source=>source.list().map(item=>({id:item.id,kind:source.kind,item,provider:source,visible:source.kind==='variable'?item.showOnCanvas!==false:visible(instance,`${source.kind==='point'||source.kind==='vector'?'slot':source.kind}:${item.id}`,item.visible!==false),description:source.describe?.(item)??'',value:source.evaluate?.(item.id)})));
}

export function variableSchemeCompatibility(scheme,template,instance){
  const adapter=template?.id==='builtin:mod-n'?'modular':template?.layout?.type==='coordinate'?'coordinate':'generic',allowed=scheme?.capabilities?.adapters??scheme?.adapters??null;if(!allowed?.length)return{supported:true,reason:''};const supported=allowed.includes(adapter)||allowed.includes('generic');return{supported,reason:supported?'':`此方案适用于 ${allowed.join('、')}，当前结构为 ${adapter}`};
}

function coordinateText(value={}){return`(${Number(value.x??0)}, ${Number(value.y??0)}, ${Number(value.z??0)})`}
