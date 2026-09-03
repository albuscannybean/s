import {LKL_SCHEMA_VERSION} from '../app-metadata.js';

export const LKL_LIMITS=Object.freeze({
  maxDeclarations:20000,
  maxNodesPerStructure:4096,
  maxNestingDepth:64,
  maxPlotSamples:4000,
  maxAttachmentBytes:25*1024*1024,
  maxBoards:512,
  maxFramesPerBoard:256
});

export const LKL_ENUMS=Object.freeze({
  referenceTypes:['knowledge','structure','content','board'],
  placementModes:['construct','reference'],
  previewPolicies:['off','compact','detailed'],
  geometryKinds:['line','area','volume'],
  geometryOperandTypes:['slot','motion','geometry','plot'],
  legacyGeometryPointTypes:['slot','motion'],
  viewProjections:['xOy','yOz','xOz','free'],
  arrangements:['horizontal-forward','horizontal-reverse','vertical-forward','vertical-reverse'],
  edgeDirections:['directed','undirected','bidirectional','cyclic','conditional','derived'],
  relationRouting:['straight','bezier','orthogonal','radial-arc'],
  relationLineStyle:['solid','dashed','dotted'],
  relationArrow:['direction','none','forward','reverse','both'],
  relationLabelPosition:['start','center','end'],
  cardinality:['one','many'],
  variableKinds:['input','derived','constant'],
  variableTypes:['number','integer','boolean','string']
});

const field=(syntax,{repeatable=false,aliases=[],enumRef=null,referenceTypes=null,format=null}={})=>({syntax,repeatable,aliases,enumRef,referenceTypes,format});
const child=(kind,{repeatable=true,idRequired=true}={})=>({kind,repeatable,idRequired});
const declaration=({required=[],fields={},children=[],topLevel=false,idRequired=true,oneOf=[]})=>({
  required,
  fields:Object.keys(fields),
  optional:Object.keys(fields).filter(name=>!required.includes(name)),
  fieldRules:fields,
  children,
  topLevel,
  idRequired,
  oneOf
});

const packageChildKinds=['knowledge','content','structure-template','structure-instance','relation','variable','variable-scheme','view','board','placement','entry','source'];

export const LKL_SCHEMA=Object.freeze({
  version:LKL_SCHEMA_VERSION,
  header:'lkl 2',
  declarationAliases:{instance:'structure-instance'},
  topLevelDeclarations:['package',...packageChildKinds],
  lexicalValues:['word','string','number','boolean','null','list'],
  declarations:{
    package:declaration({topLevel:true,required:['root'],fields:{
      id:field('scalar'),
      title:field('string'),
      description:field('string'),
      version:field('scalar'),
      migrationVersion:field('scalar',{aliases:['migration-version']}),
      suggestedTheme:field('string',{aliases:['suggested-theme']}),
      createdAt:field('scalar'),
      updatedAt:field('scalar'),
      language:field('scalar'),
      authors:field('list'),
      tags:field('list'),
      root:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      defaultEntry:field('id',{aliases:['default-view','entry']})
    },children:packageChildKinds.map(kind=>child(kind))}),
    knowledge:declaration({topLevel:true,fields:{
      id:field('scalar'),
      title:field('string'),
      'name-zh-CN':field('string',{aliases:['title-zh-CN']}),
      'name-en':field('string',{aliases:['title-en']}),
      aliases:field('list',{aliases:['alias']}),
      summary:field('string'),
      body:field('formatted-string',{format:['markdown','latex']}),
      tags:field('list'),
      source:field('scalar',{repeatable:true})
    }}),
    content:declaration({topLevel:true,fields:{
      type:field('scalar'),
      title:field('string'),
      summary:field('string'),
      body:field('formatted-string',{format:['markdown','latex']}),
      latex:field('formatted-string',{format:['latex']}),
      tags:field('list'),
      source:field('scalar',{repeatable:true})
    }}),
    'structure-template':declaration({topLevel:true,fields:{
      title:field('string',{aliases:['name']}),
      description:field('string'),
      layout:field('scalar')
    },children:[child('slot'),child('edge')]}),
    'structure-instance':declaration({topLevel:true,required:['using'],fields:{
      using:field('template-reference'),
      owner:field('id'),
      title:field('string'),
      parameter:field('key-value',{repeatable:true}),
      runtime:field('json-string')
    },children:[child('container'),child('variable'),child('geometry')]}),
    container:declaration({fields:{
      title:field('string'),
      'local-title':field('string'),
      knowledge:field('id',{repeatable:true}),
      content:field('id',{repeatable:true}),
      structure:field('id',{repeatable:true}),
      variable:field('id',{repeatable:true})
    }}),
    geometry:declaration({required:['type'],fields:{
      type:field('scalar',{enumRef:'geometryKinds'}),
      point:field('typed-reference',{repeatable:true,referenceTypes:LKL_ENUMS.legacyGeometryPointTypes}),
      operand:field('typed-reference',{repeatable:true,referenceTypes:LKL_ENUMS.geometryOperandTypes}),
      visible:field('boolean'),
      stroke:field('css-color'),
      width:field('number'),
      fill:field('css-color')
    }}),
    variable:declaration({topLevel:true,fields:{
      for:field('id',{aliases:['owner']}),
      label:field('string'),
      'display-name':field('string'),
      'name-zh-CN':field('string',{aliases:['title-zh-CN']}),
      'name-en':field('string',{aliases:['title-en']}),
      group:field('string'),
      order:field('number'),
      kind:field('scalar',{enumRef:'variableKinds'}),
      type:field('scalar',{enumRef:'variableTypes'}),
      value:field('value'),
      expression:field('formula',{aliases:['formula']}),
      'display-formula':field('string'),
      show:field('boolean')
    }}),
    'variable-scheme':declaration({topLevel:true,fields:{
      title:field('string'),
      description:field('string'),
      category:field('scalar'),
      builtin:field('boolean'),
      parameter:field('key-value',{repeatable:true}),
      'view-defaults':field('json-string'),
      favorite:field('boolean'),
      hidden:field('boolean'),
      createdAt:field('scalar'),
      updatedAt:field('scalar')
    },children:[child('variable')]}),
    relation:declaration({topLevel:true,required:['from','to'],fields:{
      from:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      to:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      type:field('scalar'),
      label:field('string'),
      body:field('formatted-string',{format:['markdown','latex']})
    }}),
    view:declaration({topLevel:true,required:['for'],fields:{
      for:field('id'),
      focus:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      layout:field('scalar'),
      mode:field('scalar'),
      arrangement:field('scalar',{enumRef:'arrangements'}),
      'preview-policy':field('scalar',{enumRef:'previewPolicies'}),
      'object-visibility':field('json-string'),
      'zoom-policy':field('scalar'),
      'semantic-zoom':field('boolean'),
      zoom:field('number'),
      'default-focus':field('id')
    },children:[child('orientation',{repeatable:false,idRequired:false}),child('camera',{repeatable:false,idRequired:false}),child('position')]}),
    orientation:declaration({idRequired:false,fields:{
      zero:field('scalar',{aliases:['zeroAnchor']}),
      direction:field('scalar'),
      rotation:field('angle')
    }}),
    camera:declaration({idRequired:false,fields:{
      projection:field('scalar',{enumRef:'viewProjections'}),
      yaw:field('number'),
      pitch:field('number')
    }}),
    position:declaration({fields:{x:field('number'),y:field('number')}}),
    board:declaration({topLevel:true,required:['owner'],fields:{
      title:field('string'),
      description:field('string'),
      owner:field('id'),
      width:field('number'),
      height:field('number')
    },children:[child('frame')]}),
    frame:declaration({required:['instance'],fields:{
      instance:field('id',{aliases:['structure']}),
      x:field('number'),
      y:field('number'),
      width:field('number'),
      height:field('number'),
      'z-index':field('number'),
      order:field('number'),
      'preview-policy':field('scalar',{enumRef:'previewPolicies'})
    }}),
    placement:declaration({topLevel:true,required:['target','parent'],fields:{
      target:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      parent:field('typed-reference',{referenceTypes:LKL_ENUMS.referenceTypes}),
      mode:field('scalar',{enumRef:'placementModes'}),
      order:field('number'),
      path:field('id')
    }}),
    entry:declaration({topLevel:true,fields:{
      title:field('string'),
      knowledge:field('id'),
      structure:field('id'),
      content:field('id'),
      board:field('id')
    },oneOf:[['knowledge','structure','content','board']]}),
    source:declaration({topLevel:true,fields:{
      title:field('string'),
      url:field('string'),
      body:field('formatted-string',{format:['markdown']}),
      attachment:field('string'),
      'media-type':field('scalar'),
      size:field('number')
    }}),
    slot:declaration({fields:{
      title:field('string',{aliases:['label']}),
      role:field('scalar'),
      order:field('number')
    }}),
    edge:declaration({required:['from','to'],fields:{
      from:field('id'),
      to:field('id'),
      direction:field('scalar',{enumRef:'edgeDirections'}),
      type:field('scalar')
    }})
  },
  typedReferenceRules:{
    'package.root':{types:LKL_ENUMS.referenceTypes,arity:2},
    'relation.from':{types:LKL_ENUMS.referenceTypes,arity:2},
    'relation.to':{types:LKL_ENUMS.referenceTypes,arity:2},
    'view.focus':{types:LKL_ENUMS.referenceTypes,arity:2},
    'placement.target':{types:LKL_ENUMS.referenceTypes,arity:2},
    'placement.parent':{types:LKL_ENUMS.referenceTypes,arity:2},
    'geometry.point':{types:LKL_ENUMS.legacyGeometryPointTypes,arity:2,legacy:true},
    'geometry.operand':{types:LKL_ENUMS.geometryOperandTypes,arity:2}
  },
  geometryGrammar:{
    declaration:'geometry <id> { ... }',
    kinds:LKL_ENUMS.geometryKinds,
    operandSyntax:'operand <slot|motion|geometry|plot> <id>',
    operandTypes:LKL_ENUMS.geometryOperandTypes,
    legacyPointSyntax:'point <slot|motion> <id>',
    legacyPointTypes:LKL_ENUMS.legacyGeometryPointTypes,
    canonicalSerialization:'operand is emitted when operandRefs exists; legacy point is preserved when only pointRefs exists',
    dynamicNamespaces:{slot:'materialized template slot',motion:'runtime.motionPoints',geometry:'sibling geometry declaration',plot:'runtime.plotExpressions'},
    constraints:{line:'exactly two slot/motion operands',area:'at least one operand; point-only areas require at least three points',volume:'at least one operand; point-only volumes require at least four points',selfReference:'forbidden'}
  },
  variableGrammar:{
    declaration:'variable <id> { ... }',
    parameterSyntax:'parameter <id> = <value>',
    ownerFields:['for','owner'],
    expressionFields:['expression','formula'],
    kinds:LKL_ENUMS.variableKinds,
    types:LKL_ENUMS.variableTypes,
    formula:{operators:['unary +','unary -','+','-','*','/','%'],functions:['mod','if','lookup'],dynamicEvaluationProhibited:true}
  },
  placementRules:{
    modes:LKL_ENUMS.placementModes,
    construct:'owns the target in the semantic containment graph',
    reference:'links without semantic ownership',
    targetAndParent:'typed references',
    structureContainerPath:'required to materialize a target inside a structure container',
    constructCycle:'reported as a warning',
    maximumConstructParentsPerObject:1
  },
  validationConstraints:{
    stableIds:'all compiled top-level objects require package-unique stable IDs',
    references:'typed and container references must resolve to an object of the declared type',
    templates:'structure-instance using must resolve to a builtin, package, or installed template',
    geometry:'kind, arity, namespace resolution, and non-recursive geometry references are validated',
    modulus:'builtin:mod-n modulus must be an integer from 2 through 64',
    lmnSlots:['L1','L2','L3','L4','M1','M2','M3','N1','N2'],
    viewPreviewPolicy:LKL_ENUMS.previewPolicies,
    sourceUrl:'javascript: URLs are forbidden',
    attachmentBytes:LKL_LIMITS.maxAttachmentBytes,
    nestingDepth:LKL_LIMITS.maxNestingDepth
  },
  roundTripConstraints:{
    pipeline:['parse','compile AST','validate','import','runtime','export','serialize','parse','compile AST','validate'],
    semanticComparator:'semanticEquivalent',
    comparatorIgnoredFields:['loc','provided','createdAt','updatedAt','runtimeState','id','validation','diagnostics','errors','warnings'],
    geometryRuntimeField:'geometryPrimitives',
    motionRuntimeField:'motionPoints',
    plotRuntimeField:'plotExpressions',
    preserveDynamicGeometryDependencies:true,
    legacyPointSyntaxReimportable:true
  }
});

export const LKL_STRUCTURE_SOURCE_SCHEMA=Object.freeze({
  header:LKL_SCHEMA.header,
  globallyImportable:false,
  roots:{
    'structure-instance':{
      required:['using'],
      fields:['using','title','result-space','parameter','layout-state','view-state','design-styles','relation-styles','object-visibility','plot-expressions','motion-points','topology-overrides'],
      children:['container','variable','geometry','relation']
    },
    'structure-template':{
      required:[],
      fields:['title','description','parameter','visual-defaults','view-capability'],
      children:[]
    }
  },
  children:{
    container:{fields:['title','local-title']},
    variable:{fields:['label','display-name','kind','type','value','expression','display-formula','show','result-space']},
    geometry:{fields:LKL_SCHEMA.declarations.geometry.fields,operandTypes:LKL_ENUMS.geometryOperandTypes,legacyPointTypes:LKL_ENUMS.legacyGeometryPointTypes},
    relation:{fields:['from','to','direction','type','label','routing','style','canonical']}
  },
  invariants:{
    templateIdentityImmutable:true,
    builtinCanonicalTopologyProtected:true,
    runtimeStateJsonFields:['result-space','layout-state','view-state','design-styles','relation-styles','object-visibility','plot-expressions','motion-points','topology-overrides','visual-defaults','view-capability'],
    geometryDependenciesPreserved:true
  }
});

export function lklSchemaCatalog(){return Object.entries(LKL_SCHEMA.declarations).map(([kind,value])=>({kind,...value}))}

export function lklManualMarkdown(){
  const sections=`${lklSchemaCatalog().map(item=>`## ${item.kind}\n\n必填：${item.required.length?item.required.map(value=>`\`${value}\``).join('、'):'无'}\n\n字段：${item.fields.map(value=>`\`${value}\``).join('、')}\n\n子声明：${item.children.length?item.children.map(value=>`\`${value.kind}\``).join('、'):'无'}`).join('\n\n')}\n\n## 几何操作数\n\n\`geometry\` 可用 \`point slot A\` / \`point motion M1\` 表示兼容的点引用，也可用统一语法 \`operand slot A\`、\`operand motion M1\`、\`operand geometry line-1\`、\`operand plot curve-1\` 引用点、动点、派生几何及曲线/曲面。导出与重新导入会保留这些动态依赖。`;
  return`# LKL ${LKL_SCHEMA.version} 使用手册\n\n本手册由运行中的 schema 元数据生成。LKL 是数据语言；以 \`/\` 开头的是独立命令语言。\n\n${sections}\n\n## 错误诊断\n\n诊断包含行号、列号、字段路径、对象 ID 与修复建议。导入采用事务并限制对象规模。\n\n## 示例\n\n### 微积分知识包\n\n\`\`\`lkl\nlkl 2\npackage calculus {\n  title "微积分百科"\n  version "1.0"\n  language "zh-CN"\n  root knowledge math\n  defaultEntry calculus-board\n}\nknowledge math { title "数学" }\nknowledge calculus { title "微积分（数学分析）" body markdown "# 极限、导数、积分与级数" }\nboard calculus-board {\n  title "微积分结构画板"\n  owner math\n}\n\`\`\`\n\n### 模 12 排盘\n\n\`\`\`lkl\nstructure-instance chart {\n  using builtin:mod-n\n  owner calendar\n  parameter modulus = 12\n  variable hour { kind "input" type "integer" value 7 group "时间" }\n  variable wenchang { kind "derived" type "integer" expression "-(hour + 2)" group "辅星" show true }\n}\n\`\`\``;
}
