export const OBJECT_INTERACTION_CONTRACT=Object.freeze({
  knowledge:Object.freeze({primary:'open',overflow:'knowledge-actions',doubleClick:'none'}),
  structure:Object.freeze({primary:'open',overflow:'structure-actions',doubleClick:'none'}),
  container:Object.freeze({primary:'open',overflow:'container-actions',doubleClick:'none'}),
  content:Object.freeze({primary:'open',overflow:'content-actions',doubleClick:'none'}),
  relation:Object.freeze({primary:'select',overflow:'relation-actions',doubleClick:'none'}),
  canvas:Object.freeze({primary:'clear-or-pan',overflow:'canvas-actions',doubleClick:'none'})
});

const aliases=Object.freeze({slot:'container',edge:'relation',formula:'content',link:'content',variable:'content'});

export function interactionFor(kind){
  const normalized=aliases[kind]??kind;
  return OBJECT_INTERACTION_CONTRACT[normalized]??OBJECT_INTERACTION_CONTRACT.content;
}

export function primaryInteraction(kind){return interactionFor(kind).primary}
export function supportsDoubleClick(kind){return interactionFor(kind).doubleClick!=='none'}

export function contentItemActions(item){
  if(item?.persistence==='runtime')return['open'];
  if(item?.type==='knowledge')return['open','reference-info','move','copy-reference','unlink'];
  if(item?.type==='structure')return['open','move','copy-reference','unlink'];
  if(item?.type==='variable')return['open','edit','toggle-visibility','copy','delete'];
  if(item?.type==='link')return['open','edit','move','copy','delete'];
  return['open','edit','move','copy','delete'];
}
