import {parseFormula} from './formula.js';
import {canonicalizeLegacyModExpression} from './variable-result-normalizer.js';
import {parseVariableSchemeLkl2,serializeVariableSchemeLkl2} from '../lkl2/variable-scheme-codec.js';
import {ensureLocalizedRecord} from '../ui/localization.js';

const uid=()=>globalThis.crypto?.randomUUID?.()??`scheme-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone=value=>structuredClone(value);

const input=(id,label,value=0,extra={})=>({id,label,type:'integer',kind:'input',value,min:0,max:11,period:12,showOnCanvas:false,...extra});
const derived=(id,label,formula,color,icon,displayFormula='')=>({id,label,type:'integer',kind:'derived',formula,expression:parseFormula(formula),displayFormula,color,icon,showOnCanvas:true,resultSpace:{type:'modular',modulusParameter:'modulus'}});

export const BLANK_VARIABLE_SCHEME=Object.freeze({id:'builtin:scheme:blank',title:'空白变量方案',name:'空白变量方案',description:'不添加变量，用于从零开始。',builtin:true,category:'builtin',parameters:{},variables:[],viewDefaults:{tokenLayout:'container'}});
export const PERIODIC_POSITION_SCHEME=Object.freeze({id:'builtin:scheme:periodic-position',title:'周期位置示例',name:'周期位置示例',description:'把一个输入值投影到当前模结构的位置。',builtin:true,category:'builtin',parameters:{},variables:[input('value','输入值',0,{period:null}),derived('position','周期位置','value','#2F7658','p','p \equiv x \pmod n')],viewDefaults:{tokenLayout:'container'}});
export const CLOCK_MAPPING_SCHEME=Object.freeze({id:'builtin:scheme:clock',title:'时钟映射',name:'时钟映射',description:'将小时映射到模 12 位置。',builtin:true,category:'builtin',parameters:{modulus:12},variables:[input('hour','小时',7),derived('clock_position','时钟位置','hour','#557C91','◷','p \equiv h \pmod {12}')],viewDefaults:{tokenLayout:'container'}});
export const WEEKDAY_MAPPING_SCHEME=Object.freeze({id:'builtin:scheme:weekday',title:'星期映射',name:'星期映射',description:'将星期序号映射到模 7 位置。',builtin:true,category:'builtin',parameters:{modulus:7},variables:[input('weekday','星期序号',1,{max:6,period:7}),derived('weekday_position','星期位置','weekday','#7657A8','周','p \equiv d \pmod 7')],viewDefaults:{tokenLayout:'container'}});
export const MODULAR_FORMULA_SCHEME=Object.freeze({id:'builtin:scheme:modular-formula',title:'模运算公式示例',name:'模运算公式示例',description:'展示两个输入变量与一个通用模运算公式。',builtin:true,category:'builtin',parameters:{},variables:[input('a','a',3),input('b','b',5),derived('sum_mod','模和','a + b','#C8922E','Σ','s \equiv a+b \pmod n')],viewDefaults:{tokenLayout:'container'}});

export const ZI_WEI_BASIC_SCHEME=Object.freeze({
  id:'builtin:scheme:zi-wei-basic',title:'紫微基础（领域示例）',name:'紫微基础（领域示例）',description:'在模结构中加入年、月、日、时及文昌、文曲示例公式。',builtin:true,category:'domain-example',parameters:{modulus:12},variables:[
    input('year','年',0),input('month','月',0),input('day','日',0),input('hour','时',7),
    derived('wenchang','文昌','-(hour + 2)','#C8922E','昌','w_c \equiv -(h+2) \pmod n'),
    derived('wenqu','文曲','hour + 4','#7657A8','曲','w_q \equiv h+4 \pmod n')
  ],viewDefaults:{tokenLayout:'container'}
});

export const BUILTIN_VARIABLE_SCHEMES=Object.freeze([BLANK_VARIABLE_SCHEME,PERIODIC_POSITION_SCHEME,CLOCK_MAPPING_SCHEME,WEEKDAY_MAPPING_SCHEME,MODULAR_FORMULA_SCHEME,ZI_WEI_BASIC_SCHEME].map(scheme=>Object.freeze(ensureLocalizedRecord(scheme))));

export function applyVariableScheme(instance,scheme,{replace=false}={}){
  if(!instance||!scheme)throw new Error('Structure instance and variable scheme are required');
  instance.parameters={...instance.parameters,...clone(scheme.parameters??{})};
  const resultSpace=instance.resultSpace??{type:'modular',modulusParameter:'modulus'},incoming=clone(scheme.variables??[]).map(variable=>{if(variable.kind!=='derived')return variable;const canonical=canonicalizeLegacyModExpression(variable.formula,variable.resultSpace??resultSpace);return{...variable,formula:canonical.formula,expression:canonical.expression,resultSpace:clone(variable.resultSpace??resultSpace)}});
  instance.variables=replace?incoming:[...instance.variables.filter(current=>!incoming.some(variable=>variable.id===current.id)),...incoming];
  instance.runtimeState??={variables:{},results:{},errors:{}};instance.runtimeState.variables??={};
  for(const variable of incoming)if(variable.kind!=='derived'&&variable.value!=null)instance.runtimeState.variables[variable.id]=variable.value;
  instance.variableScheme={id:scheme.id,title:scheme.title??scheme.name,name:scheme.title??scheme.name,appliedAt:new Date().toISOString(),viewDefaults:clone(scheme.viewDefaults??scheme.appearance??{})};
  return instance;
}

export function createVariableScheme(name,instance){
  if(!String(name).trim())throw new Error('Variable scheme name is required');
  const timestamp=new Date().toISOString(),title=String(name).trim();return{id:`custom:scheme:${uid()}`,title,name:title,description:'用户保存的变量方案',builtin:false,category:'mine',parameters:clone(instance.parameters??{}),variables:clone(instance.variables??[]),viewDefaults:clone(instance.variableScheme?.viewDefaults??{tokenLayout:'container'}),favorite:false,hidden:false,createdAt:timestamp,updatedAt:timestamp};
}

export function ensureVariableSchemes(existing=[]){
  const stored=existing.map(normalizeVariableScheme),byId=new Map(stored.map(item=>[item.id,item])),custom=stored.filter(item=>!item.builtin&&!String(item.id).startsWith('builtin:')&&!item.deleted),builtins=BUILTIN_VARIABLE_SCHEMES.map(base=>{const saved=byId.get(base.id);return normalizeVariableScheme({...clone(base),...clone(saved??{}),id:base.id,builtin:true,category:base.category,hidden:!!saved?.hidden||!!saved?.deleted,deleted:!!saved?.deleted})});
  return[...custom,...builtins];
}

export function normalizeVariableScheme(scheme){const timestamp=scheme.createdAt??new Date().toISOString(),title=String(scheme.title??scheme.name??'未命名方案');return ensureLocalizedRecord({...clone(scheme),title,name:title,description:String(scheme.description??''),variables:clone(scheme.variables??[]),parameters:clone(scheme.parameters??{}),viewDefaults:clone(scheme.viewDefaults??scheme.appearance??{}),builtin:!!scheme.builtin,category:scheme.builtin?(scheme.category==='domain-example'?'domain-example':'builtin'):'mine',favorite:!!scheme.favorite,hidden:!!scheme.hidden,createdAt:timestamp,updatedAt:scheme.updatedAt??timestamp})}

export class VariableSchemeRepository{
  constructor(schemes=[]){this.schemes=ensureVariableSchemes(schemes)}
  list({includeHidden=false,category=null}={}){return this.schemes.filter(item=>!item.deleted&&(includeHidden||!item.hidden)&&(!category||item.category===category)).map(clone)}
  get(id){const found=this.schemes.find(item=>item.id===id&&!item.deleted);return found?clone(found):null}
  update(id,patch={}){const index=this.schemes.findIndex(item=>item.id===id&&!item.deleted);if(index<0)throw new Error(`Unknown variable scheme ${id}`);const title=patch.title??patch.name;this.schemes[index]=normalizeVariableScheme({...this.schemes[index],...clone(patch),...(title?{title,name:title}:{}),builtin:this.schemes[index].builtin,category:this.schemes[index].category,updatedAt:new Date().toISOString()});return this.get(id)}
  copyAsMine(id,title=null){const source=this.get(id);if(!source)throw new Error(`Unknown variable scheme ${id}`);const timestamp=new Date().toISOString(),copy=normalizeVariableScheme({...source,id:`custom:scheme:${uid()}`,title:title??`${source.title} 副本`,name:title??`${source.title} 副本`,builtin:false,category:'mine',hidden:false,createdAt:timestamp,updatedAt:timestamp});this.schemes.unshift(copy);return clone(copy)}
  remove(id){const index=this.schemes.findIndex(item=>item.id===id);if(index<0)return false;if(this.schemes[index].builtin)this.schemes[index]=normalizeVariableScheme({...this.schemes[index],deleted:true,hidden:true,updatedAt:new Date().toISOString()});else this.schemes.splice(index,1);return true}
  replaceCurrent(id,instance){return this.update(id,{parameters:clone(instance.parameters??{}),variables:clone(instance.variables??[]),viewDefaults:clone(instance.variableScheme?.viewDefaults??{})})}
  export(id){const scheme=this.get(id);if(!scheme)throw new Error(`Unknown variable scheme ${id}`);return serializeVariableSchemeLkl2(scheme)}
  import(source){const parsed=typeof source==='string'&&/^\s*lkl\s+2\b/i.test(source)?parseVariableSchemeLkl2(source):typeof source==='string'?JSON.parse(source):clone(source),scheme=normalizeVariableScheme(parsed.scheme??parsed);if(!scheme.id)scheme.id=`custom:scheme:${uid()}`;if(scheme.builtin||String(scheme.id).startsWith('builtin:'))scheme.id=`custom:scheme:${uid()}`;scheme.builtin=false;scheme.category='mine';scheme.createdAt??=new Date().toISOString();scheme.updatedAt=new Date().toISOString();const index=this.schemes.findIndex(item=>item.id===scheme.id);if(index>=0)this.schemes[index]=scheme;else this.schemes.unshift(scheme);return clone(scheme)}
}
