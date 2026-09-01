const clone=value=>structuredClone(value??{});
export const RELATION_STYLE_FIELDS=Object.freeze(['color','width','lineStyle','arrow','routing','labelPosition','opacity']);
export const GLOBAL_RELATION_STYLE=Object.freeze({color:'#71837a',width:1.7,lineStyle:'solid',arrow:'direction',routing:'straight',labelPosition:'center',opacity:1});

const clean=style=>Object.fromEntries(RELATION_STYLE_FIELDS.filter(key=>style?.[key]!=null&&style[key]!=='').map(key=>[key,style[key]]));

export function ensureRelationStyleState(instance){
  instance.relationStyles??={structureDefault:{},typeOverrides:{},edgeOverrides:{}};
  instance.relationStyles.structureDefault??={};instance.relationStyles.typeOverrides??={};instance.relationStyles.edgeOverrides??={};
  return instance.relationStyles;
}

export function resolveRelationStyle(edge,instance,{globalTheme=GLOBAL_RELATION_STYLE,structureDefault={}}={}){
  const state=ensureRelationStyleState(instance??{}),type=String(edge?.relationType??'related');
  return{...GLOBAL_RELATION_STYLE,...clean(globalTheme),...clean(structureDefault),...clean(edge?.visual),routing:edge?.routing??structureDefault?.routing??globalTheme?.routing??GLOBAL_RELATION_STYLE.routing,...clean(state.structureDefault),...clean(state.typeOverrides[type]),...clean(state.edgeOverrides[edge?.id])};
}

export function setRelationStyle(instance,{scope='edge',edgeIds=[],relationType=null}={},patch={}){
  const state=ensureRelationStyleState(instance),value=clean(patch);
  if(scope==='all'||scope==='structure')state.structureDefault={...state.structureDefault,...value};
  else if(scope==='type'){const type=String(relationType??'related');state.typeOverrides[type]={...(state.typeOverrides[type]??{}),...value}}
  else for(const id of edgeIds)state.edgeOverrides[id]={...(state.edgeOverrides[id]??{}),...value};
  return state;
}

export function resetRelationStyle(instance,{scope='edge',edgeIds=[],relationType=null}={}){
  const state=ensureRelationStyleState(instance);
  if(scope==='all'||scope==='structure')state.structureDefault={};
  else if(scope==='type')delete state.typeOverrides[String(relationType??'related')];
  else for(const id of edgeIds)delete state.edgeOverrides[id];
  return state;
}

export function relationStyleSnapshot(instance){return clone(ensureRelationStyleState(instance))}
export const RelationStyleResolver=Object.freeze({resolve:resolveRelationStyle,set:setRelationStyle,reset:resetRelationStyle,ensure:ensureRelationStyleState});
