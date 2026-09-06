export const PROFILE_SCHEMA='lmn.object-profile/1';
// Unknown provenance stays unknown. UI state never becomes a knowledge claim.
export function objectProfile(object={},kind='object') {
 const old=object.profile??{},content=object.objectContent??{};
 return {schema:PROFILE_SCHEMA,kind,id:String(object.id??old.id??''),title:object.title??object.displayTitle??object.label??object.name??content.title??old.title??'',
  summary:object.summary??object.description??content.summary??old.summary??'',version:object.version??old.version??null,
  authors:object.authors??old.authors??[],sources:object.sources??content.sources??old.sources??[],
  createdAt:object.createdAt??old.createdAt??null,updatedAt:object.updatedAt??old.updatedAt??null,
  evidenceStatus:old.evidenceStatus??'unspecified',scope:old.scope??(kind==='settings'?'workspace':'knowledge'),
  extensions:structuredClone(old.extensions??{})};
}
export function nestedProfiles(data) {
 const entries=[];
 function visit(value,path,depth){if(depth>60||!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&value.id&&path)entries.push({path,profile:objectProfile(value,value.kind??value.type??path.split('/').at(-2)??'object')});
  for(const[key,child]of Object.entries(value))if(key!=='profile'&&child&&typeof child==='object')visit(child,path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),depth+1);
 }
 visit(data,'',0);return entries;
}
