const asRank=value=>Math.max(1,Math.min(8,Math.round(Number(value)||4)));
export const bitCount=value=>{let count=0,n=value>>>0;while(n){n&=n-1;count++}return count};
export const booleanMeet=(a,b)=>Number(a)&Number(b);
export const booleanJoin=(a,b)=>Number(a)|Number(b);
export const booleanComplement=(value,rank)=>((1<<asRank(rank))-1)^(Number(value));
export function subsetLabel(value,rank,atomLabels=[]){const labels=Array.from({length:rank},(_,index)=>atomLabels[index]??String.fromCharCode(97+index)),members=labels.filter((_,index)=>value&(1<<index));return members.length?`{${members.join(', ')}}`:'∅'}
export function bitsetLabel(value,rank){return(Number(value)>>>0).toString(2).padStart(asRank(rank),'0')}

export function generateBooleanAlgebra(rank=4,{displayMode='subset',atomLabels=[]}={}){
  rank=asRank(rank);const count=2**rank;
  const slots=Array.from({length:count},(_,value)=>({id:`b${value}`,label:displayMode==='bitset'?bitsetLabel(value,rank):subsetLabel(value,rank,atomLabels),role:value===0?'bottom':value===count-1?'top':'element',semanticCoordinate:{rank:bitCount(value),value,bitset:bitsetLabel(value,rank)},accepts:['knowledge','value','structure'],cardinality:'many'}));
  const edges=[];for(let lower=0;lower<count;lower++)for(let bit=0;bit<rank;bit++)if(!(lower&(1<<bit))){const upper=lower|(1<<bit);edges.push({id:`cover-${lower}-${upper}`,sourceSlotId:`b${lower}`,targetSlotId:`b${upper}`,direction:'directed',relationType:'cover',label:'',displayLabel:'',routing:'straight',semanticAxis:'order',visual:{showLabel:false}})}
  const warning=rank>=8?'B₈ 将生成 256 个元素，画布可读性会明显下降。':rank>=6?`B${rank} 将生成 ${count} 个以上元素，可能降低可读性。`:null;
  return{rank,slots,edges,operations:{meet:booleanMeet,join:booleanJoin,complement:value=>booleanComplement(value,rank)},warning};
}
