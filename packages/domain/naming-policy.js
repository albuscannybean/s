const subscript=value=>String(value).replace(/\d/g,digit=>'₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
const roman=value=>{let n=Math.max(1,Math.floor(Number(value)||1)),result='';for(const [number,symbol]of[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=number){result+=symbol;n-=number;}return result;};

export function formatSequenceName(index,{style='numeric',format='{n}',start=1,label=''}={}){
 if(!Number.isFinite(Number(start))||!Number.isFinite(Number(index))||Number(start)<0||Number(start)>10000||Number(index)<0||Number(index)>10000)throw new Error('编号起点与序号须为 0–10000 的有限数值。');
 const ordinal=Math.max(0,Math.floor(Number(start)||0))+Math.max(0,Math.floor(Number(index)||0)),tokens={n:String(ordinal),A:spreadsheetName(Math.max(0,ordinal-1)),a:spreadsheetName(Math.max(0,ordinal-1)).toLowerCase(),i:roman(ordinal),label:String(label??'')};
 if(style==='none')return tokens.label;
 if(style==='custom'){const source=String(format??'{n}');if(source.length>256||/\{(?!n\}|A\}|a\}|i\}|label\})/.test(source))throw new Error('编号格式最长 256 字符，只支持 {n}、{A}、{a}、{i}、{label}。');return source.replace(/\{(n|A|a|i|label)\}/g,(_,key)=>tokens[key]);}
 const number=({numeric:tokens.n,alphabet:tokens.A,lowercase:tokens.a,roman:tokens.i})[style];if(number==null)throw new Error('不支持的编号方式。');return tokens.label?number+' '+tokens.label:number;
}

/** Continue an observed sequence; an existing gap does not renumber old objects. */
export function nextSequentialLabel(values,{fallback='节点',constant=false}={}){
 const names=[...new Set(values.filter(v=>v!==null&&v!==undefined&&String(v).trim()).map(String))];if(!names.length)return fallback+' 1';
 const patterns=names.map(name=>{const m=name.match(/^(.*?)([0-9₀₁₂₃₄₅₆₇₈₉]+)([^0-9₀₁₂₃₄₅₆₇₈₉]*)$/);return m?{prefix:m[1],suffix:m[3],raw:m[2],number:Number(m[2].replace(/[₀₁₂₃₄₅₆₇₈₉]/g,d=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))}:null;});
 const last=patterns.at(-1),matching=last?patterns.filter(p=>p&&p.prefix===last.prefix&&p.suffix===last.suffix):[];
 if(matching.length>=Math.min(2,names.length)){const n=Math.max(...matching.map(p=>p.number))+1,digits=/[₀₁₂₃₄₅₆₇₈₉]/.test(last.raw)?subscript(n):/^0\d/.test(last.raw)?String(n).padStart(last.raw.length,'0'):String(n);return last.prefix+digits+last.suffix;}
 if(constant&&names.length===1)return names[0];
 if(names.every(n=>/^[A-Z]+$/.test(n))){const indices=names.map(n=>[...n].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0));return spreadsheetName(Math.max(...indices));}
 if(names.every(n=>/^[a-z]$/.test(n)))return spreadsheetName(Math.max(...names.map(n=>n.charCodeAt(0)-96))).toLowerCase();
 if(constant&&names.length)return names.at(-1);
 return firstAvailable(new Set(names),i=>fallback+' '+(i+1));
}

export function nextStructureObjectName({kind='node',instance={},definition={},language='zh-CN',relationType=null}={}){
 if(kind==='relation'){
  let edges=definition.edges??instance.overrides?.addedEdges??[];if(relationType&&edges.some(e=>e.relationType===relationType))edges=edges.filter(e=>e.relationType===relationType);
  const labels=edges.map(e=>e.label).filter(Boolean),types=[...new Set(edges.map(e=>e.relationType).filter(Boolean))];
  return{displayName:labels.length?nextSequentialLabel(labels,{constant:true,fallback:language==='en'?'Relation':'关系'}):'',relationType:relationType??(types.length===1?types[0]:'related')};
 }
 const slots=(definition.slots??instance.overrides?.addedSlots??[]).filter(s=>!s.hostAnchor&&s.role!=='host-anchor'),policy=definition.runtimeMetadata?.naming;
 if(policy)return{displayName:formatSequenceName(slots.length,{...policy,label:''})};
 return{displayName:nextSequentialLabel(slots.map(s=>s.displayLabel??s.label),{fallback:language==='en'?'Node':'节点'})};
}

function spreadsheetName(index){
  if(!Number.isSafeInteger(Number(index))||Number(index)<0)throw new Error('字母编号需要非负安全整数。');
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

export function nextObjectName({kind,instance={},definition={},language='zh-CN'}={}){
  if(kind==='node'||kind==='relation')return nextStructureObjectName({kind,instance,definition,language});
  const names=displayNames(instance,definition);
  const allSlots=[...(definition.slots??[]),...(instance.overrides?.addedSlots??[])],isSurface=p=>p.kind==='surface'||/^\s*z\s*=/.test(p.source??'')||/^S[₀-₉\d]/.test(p.label??'');
  const candidates=kind==='point'?allSlots.filter(s=>s.role==='point'||(!s.role&&/^[A-Z]+$/.test(s.label??''))):kind==='vector'?allSlots.filter(s=>['vector','vector-end'].includes(s.role)):kind==='motion'?(instance.motionPoints??[]):kind==='curve'?(instance.plotExpressions??[]).filter(p=>!isSurface(p)):kind==='surface'?(instance.plotExpressions??[]).filter(isSurface):[];
  const observed=[...new Set(candidates.map(s=>s.displayName??s.displayLabel??s.label).filter(Boolean))];
  if(observed.length){let displayName=nextSequentialLabel(observed,{fallback:({point:'P',vector:'v',curve:'C',surface:'S',motion:'M'})[kind]??'Object'});for(let attempts=0;attempts<10000&&names.has(displayName);attempts++)displayName=nextSequentialLabel([...observed,displayName],{fallback:kind});return{id:`${kind}-${globalThis.crypto?.randomUUID?.()??Date.now()}`,displayName};}
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
