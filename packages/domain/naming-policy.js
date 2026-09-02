const subscript=value=>String(value).replace(/\d/g,digit=>'₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);

function spreadsheetName(index){
  let value=Math.max(0,Number(index)||0),name='';
  do{name=String.fromCharCode(65+value%26)+name;value=Math.floor(value/26)-1}while(value>=0);
  return name;
}

function displayNames(instance={},definition={}){
  return new Set([
    ...(definition.slots??[]).map(item=>item.displayLabel??item.label),
    ...(instance.overrides?.addedSlots??[]).map(item=>item.displayLabel??item.label),
    ...(instance.variables??[]).flatMap(item=>[item.displayName,item.label]),
    ...(instance.plotExpressions??[]).map(item=>item.label),
    ...(instance.motionPoints??[]).map(item=>item.label)
  ].filter(Boolean).map(String));
}

function firstAvailable(names,make){for(let index=0;index<10000;index++){const candidate=make(index);if(!names.has(candidate))return candidate}return make(Date.now())}

export function nextObjectName({kind,instance={},definition={}}={}){
  const names=displayNames(instance,definition);
  if(kind==='point')return{id:`point-${Date.now()}`,displayName:firstAvailable(names,index=>spreadsheetName(index))};
  if(kind==='vector'){const displayName=firstAvailable(names,index=>`v${subscript(index+1)}`);return{id:`v${Math.max(1,(instance.overrides?.addedSlots??[]).filter(item=>item.role==='vector-end').length+1)}`,displayName}}
  if(kind==='curve')return{id:`curve-${Date.now()}`,displayName:firstAvailable(names,index=>`C${subscript(index+1)}`)};
  if(kind==='surface')return{id:`surface-${Date.now()}`,displayName:firstAvailable(names,index=>`S${subscript(index+1)}`)};
  if(kind==='motion')return{id:`motion-${Date.now()}`,displayName:firstAvailable(names,index=>`M${index+1}`)};
  if(kind==='timeline')return{id:`timeline-${Date.now()}`,displayName:firstAvailable(names,index=>`timeline${index+1}`)};
  if(['line','area','volume'].includes(kind))return{id:`${kind}-${Date.now()}`,displayName:''};
  return{id:`object-${Date.now()}`,displayName:firstAvailable(names,index=>`对象 ${index+1}`)};
}

export {spreadsheetName};
