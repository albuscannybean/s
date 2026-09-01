export const DOCUMENT_ROUTE_PARTS=Object.freeze({
  structure:1,
  source:1,
  container:2,
  content:3,
  'content-edit':3,
  'content-draft':3,
  relation:2,
  'relation-edit':2
});

const safeDecode=value=>{
  try{return{valid:true,value:decodeURIComponent(value)}}
  catch{return{valid:false,value}}
};

export function makeDocumentId(kind,...parts){
  const expected=DOCUMENT_ROUTE_PARTS[kind];
  if(expected==null)throw new Error(`Unsupported document route kind: ${kind}`);
  if(parts.length!==expected)throw new Error(`${kind} document route requires ${expected} parts`);
  return`${kind}:${parts.map(part=>encodeURIComponent(String(part))).join(':')}`;
}

export function parseDocumentId(id){
  const source=String(id??''),separator=source.indexOf(':'),kind=separator<0?source:source.slice(0,separator),expected=DOCUMENT_ROUTE_PARTS[kind];
  if(expected==null)return{valid:false,kind,parts:[],reason:'unsupported-kind'};
  const encoded=separator<0?[]:source.slice(separator+1).split(':');
  if(encoded.length!==expected)return{valid:false,kind,parts:[],reason:'part-count'};
  const decoded=encoded.map(safeDecode);
  if(decoded.some(part=>!part.valid))return{valid:false,kind,parts:[],reason:'malformed-encoding'};
  return{valid:true,kind,parts:decoded.map(part=>part.value),encodedParts:encoded};
}

export function documentRouteKind(id){
  const source=String(id??''),separator=source.indexOf(':'),kind=separator<0?source:source.slice(0,separator);
  return DOCUMENT_ROUTE_PARTS[kind]==null?null:kind;
}
