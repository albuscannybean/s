import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {APP_RELEASE,APP_VERSION,LKL_SCHEMA_VERSION} from '../packages/app-metadata.js';
import {LKL_ENUMS,LKL_LIMITS,LKL_SCHEMA,LKL_STRUCTURE_SOURCE_SCHEMA} from '../packages/lkl2/schema.js';
import {BUILTIN_TEMPLATES,materializeTemplate} from '../packages/structure-engine/templates.js';
import {GLOBAL_RELATION_STYLE,RELATION_STYLE_FIELDS} from '../packages/structure-engine/relation-style-resolver.js';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','lkl-ai-authoring-kit-v4.3.0');
const machineRoot=kitRoot;

const lkl1Directives={
  structure:{arguments:['id','name'],required:true},
  description:{arguments:['text']},
  category:{arguments:['category']},
  layout:{arguments:['type','json-options']},
  visual:{arguments:['json']},
  flags:{arguments:['json']},
  parameter:{arguments:['id','label','type','default-json','metadata-json']},
  variable:{arguments:['id','label','type','kind','value-json','formula','expression-json']},
  slot:{arguments:['id','label','role','cardinality','accepts-csv','semantic-coordinate-json']},
  edge:{arguments:['id','from','to','direction','relation-type','label','routing','semantic-axis','visual-json']},
  constraint:{arguments:['json']},
  rule:{arguments:['json']},
  factory:{arguments:['runtime-factory-id'],policy:'existing-runtime-factories-only'},
  end:{arguments:[],required:true}
};

const templateRecord=template=>{
  const defaults=Object.fromEntries((template.parameters??[]).map(item=>[item.id,item.defaultValue]));
  const materialized=materializeTemplate(template,defaults);
  return{
    id:template.id,
    name:template.name,
    names:template.nameI18n??null,
    description:template.description??'',
    version:template.version,
    category:template.category,
    maturity:template.maturity??'ready',
    deprecated:!!template.deprecated,
    replacementTemplateId:template.replacementTemplateId??null,
    nestable:template.nestable!==false,
    computable:!!template.computable,
    factory:template.slotFactory??null,
    parameters:(template.parameters??[]).map(({id,label,type,defaultValue,min,max,options})=>({id,label,type,defaultValue,min:min??null,max:max??null,options:options??null})),
    defaultSlots:(materialized.slots??[]).map(slot=>({id:slot.id,label:slot.label,role:slot.role,cardinality:slot.cardinality,accepts:slot.accepts,semanticCoordinate:slot.semanticCoordinate})),
    defaultEdges:(materialized.edges??[]).map(edge=>({id:edge.id,from:edge.sourceSlotId,to:edge.targetSlotId,direction:edge.direction,type:edge.relationType,label:edge.label??'',routing:edge.routing??null})),
    layout:materialized.layout??template.layout,
    viewCapability:template.viewCapability??null
  };
};

const declarationRecord=([kind,schema])=>({
  kind,
  topLevel:schema.topLevel,
  idRequired:schema.idRequired,
  requiredFields:schema.required,
  optionalFields:schema.optional,
  acceptedFields:[...new Set([...schema.fields,...Object.values(schema.fieldRules).flatMap(rule=>rule.aliases??[])])],
  fieldRules:schema.fieldRules,
  childDeclarations:schema.children,
  oneOf:schema.oneOf
});
const declarations=Object.fromEntries(Object.entries(LKL_SCHEMA.declarations).map(entry=>[entry[0],declarationRecord(entry)]));
const builtins=BUILTIN_TEMPLATES.map(templateRecord);
const builtinCatalog={
  templateIds:builtins.map(template=>template.id),
  containerSlotIdsByTemplate:Object.fromEntries(builtins.map(template=>[template.id,template.defaultSlots.map(slot=>slot.id)])),
  parametersByTemplate:Object.fromEntries(builtins.map(template=>[template.id,template.parameters]))
};

const contract={
  contract:'LMN LKL AI Authoring Contract',
  schemaVersion:LKL_SCHEMA.version,
  kitVersion:'4.3.1',
  target:{application:'LMN Knowledge System',release:APP_RELEASE,version:APP_VERSION,lkl1:'1',lkl2:LKL_SCHEMA_VERSION},
  generatedFrom:{schema:'packages/lkl2/schema.js',parser:'packages/lkl2/parser.js',ast:'packages/lkl2/ast.js',validator:'packages/lkl2/validator.js',importer:'packages/lkl2/importer.js',serializer:'packages/lkl2/serializer.js',exporter:'packages/lkl2/exporter.js',structureSource:'packages/lkl2/structure-source.js',runtimeCatalog:'packages/structure-engine/templates.js'},
  authorityOrder:['lkl-authoring-contract.json','LKL-AI-AUTHORING.md','user request and supplied facts'],
  outputPolicy:{default:'one complete LKL 2 Knowledge Package',whenBuiltinStructuresAreInsufficient:['one LKL 1 Structure Template','one LKL 2 Knowledge Package that references the imported custom template'],forbidPseudocode:true,forbidNewBoardsAndFrames:true},
  sourceKinds:{
    lkl1:{header:'lkl 1',purpose:'reusable structure template',requiresEnd:true,directives:lkl1Directives,aliases:{graph:'structure',node:'slot',relation:'edge'}},
    lkl2Package:{header:LKL_SCHEMA.header,purpose:'complete importable knowledge package',requiresExactlyOnePackage:true,topLevelDeclarations:LKL_SCHEMA.topLevelDeclarations,declarationAliases:LKL_SCHEMA.declarationAliases,declarations},
    lkl2StructureSource:{header:LKL_SCHEMA.header,purpose:'in-app editing of one existing structure instance or built-in template defaults',...LKL_STRUCTURE_SOURCE_SCHEMA}
  },
  enums:{
    ...LKL_ENUMS,
    newPackageReferenceTypes:['knowledge','structure','content'],
  },
  typedReferenceRules:LKL_SCHEMA.typedReferenceRules,
  geometryGrammar:LKL_SCHEMA.geometryGrammar,
  variableGrammar:LKL_SCHEMA.variableGrammar,
  placementRules:LKL_SCHEMA.placementRules,
  constructReferenceInvariants:{constructOwnership:true,referenceOwnership:false,constructCyclesAreWarnings:true,maxConstructPlacementsPerObject:LKL_SCHEMA.placementRules.maximumConstructParentsPerObject},
  parserLimits:{header:LKL_SCHEMA.header,topLevelDeclarations:LKL_SCHEMA.topLevelDeclarations,declarationAliases:LKL_SCHEMA.declarationAliases,lexicalValues:LKL_SCHEMA.lexicalValues,unknownTopLevelDeclarations:'rejected by parser',unknownPackageFields:'rejected before AST compilation',unknownPackageChildren:'rejected before AST compilation',unknownStructureSourceFields:'rejected by Structure Source parser',...LKL_LIMITS},
  validationConstraints:LKL_SCHEMA.validationConstraints,
  roundTripConstraints:LKL_SCHEMA.roundTripConstraints,
  relationStyle:{fields:RELATION_STYLE_FIELDS,defaults:GLOBAL_RELATION_STYLE},
  formulaLanguage:{operators:['unary +','unary -','+','-','*','/','%'],functions:['mod','if','lookup'],textComparisonsSupported:false,dynamicEvaluationProhibited:true},
  plotLanguage:{functions:['sin','cos','tan','asin','acos','atan','sqrt','abs','exp','ln','log','min','max','floor','ceil','round'],constants:['pi','e'],forms:['y=expression','x=expression; y=expression','x=expression; y=expression; z=expression'],presets:['heart','cycloid','circle','ellipse','parabola','helix','sphere','torus','paraboloid']},
  import:{strategies:{merge:'update explicitly supplied fields while preserving local identity',replace:'replace the same package namespace after confirmation',copy:'create a new namespace and remap internal references'},transactional:true,strictErrorsBlockImport:true,stableIdsRequired:true},
  authorshipPermissions:{
    allowed:['create LKL 1 templates','create LKL 2 packages','create knowledge, content, structures, variables, relations, views, placements, entries and source metadata','use documented built-in templates','mark uncertainty and placeholders explicitly'],
    conditional:['quote or adapt third-party material only when rights permit','use personal data only with user authority and applicable-law compliance','use custom factory IDs only when the target runtime already implements them'],
    prohibited:['invent sources, quotations or empirical support','emit javascript: URLs','emit executable JavaScript or dynamic eval rules','claim traditional or speculative systems are scientifically validated without evidence','create new board or frame declarations','claim a structure-source fragment is a complete package']
  },
  epistemicLabels:['verified-fact','source-backed-claim','traditional-claim','interpretation','hypothesis','example','placeholder','disputed'],
  hardLimits:LKL_LIMITS,
  specialConstraints:{modulus:{template:'builtin:mod-n',integer:true,min:2,max:64},lmnContainers:['L1','L2','L3','L4','M1','M2','M3','N1','N2'],maxConstructPlacementsPerObject:1},
  compatibilityOnly:['board','frame','builtin:mod-12','builtin:vector-space'],
  builtinCatalog,
  builtins
};

await mkdir(machineRoot,{recursive:true});
await writeFile(path.join(machineRoot,'lkl-authoring-contract.json'),`${JSON.stringify(contract,null,2)}\n`,'utf8');
console.log(`Generated ${contract.builtins.length} built-in templates for ${APP_RELEASE}.`);
