import {parseFormula} from './formula.js';

const clone=value=>value==null?value:structuredClone(value);

export function modularNormalize(value,modulus){
  const number=Number(value),n=Number(modulus);
  if(!Number.isFinite(number))throw new Error('modular result must be a finite number');
  if(!Number.isFinite(n)||n<=0)throw new Error('modulus must be positive');
  return((number%n)+n)%n;
}

export function resolveResultSpace(resultSpace,scope={}){
  if(!resultSpace||resultSpace.type!=='modular')return resultSpace?clone(resultSpace):null;
  const parameter=String(resultSpace.modulusParameter??'modulus'),modulus=Number(scope[parameter]);
  return{...clone(resultSpace),type:'modular',modulusParameter:parameter,modulus};
}

export function normalizeVariableResult(value,resultSpace,scope={}){
  const resolved=resolveResultSpace(resultSpace,scope);
  return resolved?.type==='modular'?modularNormalize(value,resolved.modulus):value;
}

export function resultSpaceLabel(resultSpace,scope={}){
  const resolved=resolveResultSpace(resultSpace,scope);
  return resolved?.type==='modular'&&Number.isFinite(resolved.modulus)?`ℤ/${resolved.modulus}ℤ`:'普通数值空间';
}

export function canonicalizeLegacyModExpression(formula,resultSpace){
  const source=String(formula??'').trim();
  if(!source||resultSpace?.type!=='modular')return{formula:source,expression:source?parseFormula(source):null,canonicalized:false};
  const expression=parseFormula(source),parameter=String(resultSpace.modulusParameter??'modulus');
  if(expression?.op!=='mod'||expression.args?.length!==2||expression.args[1]?.var!==parameter)return{formula:source,expression,canonicalized:false};
  return{formula:unwrapTopLevelMod(source,parameter)??source,expression:clone(expression.args[0]),canonicalized:true,legacyFormula:source};
}

function unwrapTopLevelMod(source,parameter){
  if(!source.startsWith('mod(')||!source.endsWith(')'))return null;
  const body=source.slice(4,-1);let depth=0,quote=null,comma=-1;
  for(let index=0;index<body.length;index++){
    const char=body[index];if(quote){if(char===quote&&body[index-1]!=='\\')quote=null;continue}if(char==='"'||char==="'"){quote=char;continue}if(char==='(')depth++;else if(char===')')depth--;else if(char===','&&depth===0){comma=index;break}
  }
  if(comma<0||body.slice(comma+1).trim()!==parameter)return null;
  return body.slice(0,comma).trim();
}

export const VariableResultNormalizer=Object.freeze({normalize:normalizeVariableResult,resolve:resolveResultSpace,label:resultSpaceLabel,canonicalizeLegacy:canonicalizeLegacyModExpression});
