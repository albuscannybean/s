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

export function uiText(key,language=LANGUAGE_FALLBACK){return UI_TEXT[language]?.[key]??UI_TEXT[LANGUAGE_FALLBACK][key]??key}

export function validateLocalizedRecords(records=[]){return records.flatMap(record=>{const value=record.nameI18n??record.titleI18n;return value?.['zh-CN']&&value?.en?[]:[`${record.id??record.name??'record'} 缺少中英文名称`]})}
