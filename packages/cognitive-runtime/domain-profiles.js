const clone=value=>structuredClone(value);
const unique=value=>[...new Set((Array.isArray(value)?value:value==null?[]:[value]).map(item=>String(item).trim()).filter(Boolean))];
const normalize=value=>String(value??'').normalize('NFKC').trim().toLowerCase();

export const BUILTIN_DOMAIN_PROFILES=Object.freeze([
  {id:'general',label:'通用知识',canonicalObjects:[],highValueDistinctions:[],operations:['retrieve','compare','explain'],evidenceRules:['preserve source attribution'],successCriteria:['traceable result'],failureModes:['unsupported claim'],confidence:'source-sensitive',sourceScope:'task context',vocabulary:[],relationTypes:['related','depends-on','supports'],preferredStructures:['builtin:directed-graph']},
  {id:'mathematics',label:'数学',canonicalObjects:['definition','theorem','proof','example','counterexample'],highValueDistinctions:['necessary/sufficient','example/proof','local/global'],operations:['calculate','derive','prove','verify'],evidenceRules:['preserve assumptions','show dependency chain'],successCriteria:['valid derivation'],failureModes:['hidden assumption','domain error'],confidence:'proof-sensitive',sourceScope:'activated knowledge',vocabulary:['definition','theorem','proof','example','counterexample','定义','定理','证明','例','反例'],relationTypes:['depends-on','requires','prerequisite','implies','proves','supports'],preferredStructures:['builtin:proof-tree','builtin:dependency-dag','builtin:directed-graph']},
  {id:'philosophy',label:'哲学',canonicalObjects:['problem','concept','distinction','premise','commitment','consequence','objection','revision'],highValueDistinctions:['claim/commitment','argument/objection','concept/application'],operations:['interpret','distinguish','argue','revise'],evidenceRules:['preserve argumentative context','separate claim from objection'],successCriteria:['coherent distinctions','traceable argument'],failureModes:['category confusion','context loss'],confidence:'argument-sensitive',sourceScope:'activated knowledge',vocabulary:['problem','concept','distinction','premise','consequence','objection','问题','概念','区分','前提','后果','异议'],relationTypes:['supports','objects-to','responds-to','implies','depends-on','contrasts-with'],preferredStructures:['builtin:directed-graph','builtin:tree']},
  {id:'literature',label:'文学',canonicalObjects:['work','passage','character','motif','voice','context','interpretation'],highValueDistinctions:['text/context','speaker/author','motif/theme'],operations:['interpret','contextualize','compare','synthesize'],evidenceRules:['ground interpretation in source','preserve textual context'],successCriteria:['source-grounded interpretation'],failureModes:['context loss','unsupported reading'],confidence:'source-sensitive',sourceScope:'activated knowledge',vocabulary:['work','passage','character','motif','theme','作品','文本','人物','意象','主题','语境'],relationTypes:['references','contrasts-with','develops','echoes','part-of','related'],preferredStructures:['builtin:directed-graph','builtin:tree']}
]);

const DOMAIN_ALIASES=Object.freeze({
  general:['general','通用','一般','综合'],
  mathematics:['mathematics','math','maths','数学','代数','algebra','群论','group theory','数学分析','analysis','几何','geometry','拓扑','topology','数论','number theory'],
  philosophy:['philosophy','哲学','伦理学','ethics','认识论','epistemology','形而上学','metaphysics','逻辑哲学'],
  literature:['literature','literary','文学','诗歌','poetry','小说','novel','戏剧','drama']
});

const exactBaseTerms=new Set(['general','通用','一般','综合','mathematics','math','maths','数学','philosophy','哲学','literature','literary','文学']);

export function createDomainProfile(value={}){
  const list=field=>unique(value[field]);
  return{id:String(value.id??'custom'),label:String(value.label??value.id??'自定义领域'),canonicalObjects:list('canonicalObjects'),highValueDistinctions:list('highValueDistinctions'),operations:list('operations'),evidenceRules:list('evidenceRules'),successCriteria:list('successCriteria'),failureModes:list('failureModes'),confidence:value.confidence??null,sourceScope:value.sourceScope??null,vocabulary:list('vocabulary'),relationTypes:list('relationTypes'),preferredStructures:list('preferredStructures'),localConstraints:list('localConstraints')};
}

function matchProfileId(value){
  const source=normalize(value);
  if(!source)return'general';
  for(const[id,aliases]of Object.entries(DOMAIN_ALIASES))if(aliases.some(alias=>source===normalize(alias)||source.includes(normalize(alias))))return id;
  return'general';
}

export function resolveDomainProfile(id){
  if(id&&typeof id==='object')return createDomainProfile(id);
  const source=String(id??'general').trim(),profileId=matchProfileId(source),profile=clone(BUILTIN_DOMAIN_PROFILES.find(item=>item.id===profileId)??BUILTIN_DOMAIN_PROFILES[0]);
  if(source&&!exactBaseTerms.has(normalize(source)))profile.localConstraints=unique([...(profile.localConstraints??[]),source]);
  return profile;
}

export function resolveDomainInput(input=[]){
  const values=(Array.isArray(input)?input:[input]).flatMap(value=>typeof value==='string'?value.split(/[,;，；]+/):[value]).filter(value=>value!=null&&String(value).trim());
  const profiles=values.length?values.map(resolveDomainProfile):[resolveDomainProfile('general')],profileIds=unique(profiles.map(item=>item.id));
  const localConstraints=unique(profiles.flatMap(item=>item.localConstraints??[]));
  const profile=composeDomainProfiles(...profileIds.map(resolveDomainProfile),localConstraints.length?{id:'local',label:'本地约束',vocabulary:localConstraints,localConstraints}:null);
  profile.id=profileIds.join('+')||'general';profile.label=profileIds.map(id=>BUILTIN_DOMAIN_PROFILES.find(item=>item.id===id)?.label??id).join(' / ');profile.localConstraints=localConstraints;
  return{input:values.map(value=>typeof value==='string'?value:value.id??value.label??'custom'),profileIds,profiles:profileIds.map(resolveDomainProfile),profile,localConstraints,fallback:profileIds.length===1&&profileIds[0]==='general'&&localConstraints.length>0};
}

export function composeDomainProfiles(...profiles){
  const values=profiles.flat().filter(Boolean).map(item=>typeof item==='string'?resolveDomainProfile(item):createDomainProfile(item)),merged={id:values.map(item=>item.id).join('+')||'general',label:values.map(item=>item.label).join(' / ')||'通用知识',confidence:values.map(item=>item.confidence).filter(Boolean).join(' + ')||null,sourceScope:values.map(item=>item.sourceScope).filter(Boolean).join(' + ')||null};
  for(const field of['canonicalObjects','highValueDistinctions','operations','evidenceRules','successCriteria','failureModes','vocabulary','relationTypes','preferredStructures','localConstraints'])merged[field]=unique(values.flatMap(item=>item[field]??[]));
  return createDomainProfile(merged);
}
