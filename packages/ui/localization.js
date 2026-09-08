import {UI_CATALOG} from './ui-catalog.js';
const LANGUAGE_FALLBACK='zh-CN';

export const UI_TEXT=Object.freeze({
  'zh-CN':{notes:'笔记',knowledgePackage:'知识包',code:'代码',sceneReady:'场景就绪',importPackage:'导入知识包',exportBackup:'导出 / 备份'},
  en:{notes:'Notes',knowledgePackage:'Knowledge Package',code:'Code',sceneReady:'Scene ready',importPackage:'Import package',exportBackup:'Export / Backup'}
});

export function localized(value,language=LANGUAGE_FALLBACK,fallback=''){
  if(value&&typeof value==='object'&&!Array.isArray(value))return String(value[language]??value[language.split('-')[0]]??value[LANGUAGE_FALLBACK]??value.en??Object.values(value)[0]??fallback);
  return String(value??fallback);
}

export function bilingual(zh,en=zh){return{'zh-CN':String(zh??''),en:String(en??zh??'')}}

export function ensureLocalizedRecord(record={},fallbackName=''){
  const raw=String(record.name??record.title??fallbackName),slash=raw.split(/\s+(?:\/|·)\s+/),name=record.nameI18n??record.titleI18n??bilingual(slash[0]||raw,slash.slice(1).join(' · ')||raw),description=record.descriptionI18n??bilingual(record.description??'',record.descriptionEn??record.description??'');
  return{...record,nameI18n:name,descriptionI18n:description};
}

export function uiText(key,language=LANGUAGE_FALLBACK){return UI_TEXT[normalizeLanguage(language)]?.[key]??UI_TEXT[LANGUAGE_FALLBACK][key]??translateUI(key,language)}

export function normalizeLanguage(language=LANGUAGE_FALLBACK){return String(language).toLowerCase().startsWith('en')?'en':'zh-CN'}
// Call only with system-owned copy, never arbitrary user data or a rendered document.
export function translateUI(text,language=LANGUAGE_FALLBACK){
 const raw=String(text??''),key=raw.trim(),value=UI_CATALOG[key]?.[normalizeLanguage(language)];
 return value==null?raw:raw.slice(0,raw.indexOf(key))+value+raw.slice(raw.indexOf(key)+key.length);
}
export function contentTypeLabel(type,language=LANGUAGE_FALLBACK){return translateUI(type,language)}

const BUILTIN_NAMES=Object.freeze({
 'builtin:boolean-algebra':['布尔代数 Bₙ','Boolean Algebra Bₙ'],
 'builtin:regular-polygon':['正 n 边形','Regular n-gon'],
 'builtin:coordinate-plane':['向量空间','Vector Space'],
 'builtin:cyclic-group':['循环群 Cₙ','Cyclic Group Cₙ'],
 'builtin:operation-table':['有限运算表','Finite Operation Table'],
 'builtin:mod-n':['模结构 ℤ/nℤ','Modular Space ℤ/nℤ'],
 'builtin:poset-hasse':['偏序与哈斯图','Partial Order / Hasse'],
 'builtin:lmn-432':['LMN 4–3–2','LMN 4–3–2'],
 'builtin:n-center':['n 元中心','Center & Facets']
});
// Metadata only: no template identity, parameter value or mathematical model is changed.
export function ensureBuiltinLocalizedRecord(template){
 const record=ensureLocalizedRecord(template),names=BUILTIN_NAMES[template.id];
 if(names)record.nameI18n=bilingual(...names);
 record.descriptionI18n=bilingual(translateUI(template.description,'zh-CN'),translateUI(template.description,'en'));
 record.parameters=(template.parameters??[]).map(parameter=>({...parameter,labelI18n:parameter.labelI18n??bilingual(translateUI(parameter.label,'zh-CN'),translateUI(parameter.label,'en')),...(parameter.options?{options:parameter.options.map(option=>typeof option==='string'?option:{...option,labelI18n:option.labelI18n??bilingual(translateUI(option.label,'zh-CN'),translateUI(option.label,'en'))})}:{})}));
 return record;
}


// Translate only the static segments of a tagged UI template. Interpolated user values
// must be appended by the caller after this function returns; this never scans a DOM.
export function translateUIFragment(source,language=LANGUAGE_FALLBACK){
 const locale=normalizeLanguage(language),translateText=text=>{
  const exact=translateUI(text,locale);if(exact!==text)return exact;
  return text.replace(UI_FRAGMENT_PATTERN,match=>UI_CATALOG[match]?.[locale]??match);
 };
 return String(source??'').split(/(<[^>]*>)/g).map(part=>{
  if(part.startsWith('<'))return part.replace(/\b(title|placeholder|aria-label)=(["'])(.*?)\2/g,(_all,attr,quote,value)=>attr+'='+quote+translateText(value)+quote);
  return translateText(part);
 }).join('');
}

// Preserve complete tags while keeping interpolated user content opaque to translation.
export function translateUITemplate(strings,values,language=LANGUAGE_FALLBACK){
 const source=strings.map((part,index)=>part+(index<values.length?`\uE000${index}\uE001`:'')).join('');
 return translateUIFragment(source,language).replace(/\uE000(\d+)\uE001/g,(_match,index)=>String(values[Number(index)]??''));
}
const UI_FRAGMENT_PATTERN=new RegExp(Object.keys(UI_CATALOG).filter(key=>key.length>1).sort((a,b)=>b.length-a.length).map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');

export function applyUITranslations(root,language=LANGUAGE_FALLBACK){
 if(!root)return;const locale=normalizeLanguage(language),selector='[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-aria-label]';
 const elements=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
 for(const element of elements){
  if(element.hasAttribute('data-i18n'))element.textContent=translateUI(element.getAttribute('data-i18n'),locale);
  for(const attr of['title','placeholder','aria-label'])if(element.hasAttribute('data-i18n-'+attr))element.setAttribute(attr,translateUI(element.getAttribute('data-i18n-'+attr),locale));
 }
 const documentRef=root.nodeType===9?root:root.ownerDocument;if(documentRef?.documentElement)documentRef.documentElement.lang=locale;
}
const SYSTEM_RELATIONS=Object.freeze({
 'parent-of':['包含','Contains'],'child-of':['属于','Belongs to'],'part-of':['组成部分','Part of'],
 'depends-on':['依赖','Depends on'],'prerequisite':['前置条件','Prerequisite'],'implies':['蕴含','Implies'],
 'equivalent':['等价','Equivalent'],'equivalent-to':['等价','Equivalent'],'contrasts-with':['对比','Contrasts with'],
 'supports':['支持','Supports'],'applies-to':['应用于','Applies to'],'related':['关联','Related'],
 'localize':['局部化','Localize'],'theorem':['定理推导','Theorem'],'boundary-check':['边界检验','Boundary check'],
 'proof-pattern':['证明方法','Proof pattern'],'select-test':['选择判别法','Choose test'],'positive':['正项','Positive terms'],
 'alternating':['交错','Alternating terms'],'necessary':['必要条件','Necessary'],'not-sufficient':['非充分条件','Not sufficient'],
 'sufficient':['充分条件','Sufficient'],'necessary-and-sufficient':['充要条件','Necessary and sufficient']
});
// This display projection does not change the raw relation ID, type or persisted label.
export function systemRelationLabel(value,language=LANGUAGE_FALLBACK){const raw=String(value??'');return SYSTEM_RELATIONS[raw]?.[normalizeLanguage(language)==='en'?1:0]??raw}


export function validateLocalizedRecords(records=[]){return records.flatMap(record=>{const value=record.nameI18n??record.titleI18n;return value?.['zh-CN']&&value?.en?[]:[`${record.id??record.name??'record'} 缺少中英文名称`]})}
