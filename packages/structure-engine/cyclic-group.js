const integer=(value,fallback=0)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback;

export function gcd(a,b){
  let left=Math.abs(integer(a)),right=Math.abs(integer(b));
  while(right)[left,right]=[right,left%right];
  return left;
}

export function normalizeResidue(value,n){
  const modulus=Math.max(1,Math.abs(integer(n,1)));
  return((integer(value)%modulus)+modulus)%modulus;
}

export function generatedSubgroup(n,element){
  const modulus=Math.max(2,Math.abs(integer(n,2))),step=normalizeResidue(element,modulus),values=[];
  let current=0;
  do{values.push(current);current=normalizeResidue(current+step,modulus)}while(current!==0&&values.length<=modulus);
  return values;
}

export function elementOrder(n,element){return generatedSubgroup(n,element).length}

export function validGenerators(n){
  const modulus=Math.max(2,Math.abs(integer(n,2)));
  return Array.from({length:modulus},(_,value)=>value).filter(value=>gcd(value,modulus)===1);
}

export function analyzeCyclicElement(n,element){
  const modulus=Math.max(2,Math.abs(integer(n,2))),selected=normalizeResidue(element,modulus),divisor=gcd(selected,modulus),subgroup=generatedSubgroup(modulus,selected),order=subgroup.length;
  return{n:modulus,element:selected,gcd:divisor,order,subgroup,subgroupSize:subgroup.length,orbitCount:divisor,isGenerator:divisor===1,validGenerators:validGenerators(modulus)};
}
