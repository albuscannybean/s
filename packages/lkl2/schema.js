import {LKL_SCHEMA_VERSION} from '../app-metadata.js';

export const LKL_LIMITS=Object.freeze({maxDeclarations:20000,maxNodesPerStructure:4096,maxNestingDepth:64,maxPlotSamples:4000,maxAttachmentBytes:25*1024*1024,maxBoards:512,maxFramesPerBoard:256});

export const LKL_SCHEMA=Object.freeze({
  version:LKL_SCHEMA_VERSION,
  declarations:{
    package:{required:['id','title','version','root'],fields:['id','title','description','version','language','authors','tags','root','defaultEntry','migrationVersion','suggestedTheme']},
    knowledge:{required:['title'],fields:['id','title','name.zh-CN','name.en','aliases','summary','body','tags','source']},
    content:{required:['type'],fields:['type','title','summary','body','latex','tags','source','link','proof','theorem','example']},
    'structure-template':{required:['title'],fields:['title','name.zh-CN','name.en','description','layout','slot','edge']},
    'structure-instance':{required:['using'],fields:['using','owner','title','parameter','container','variable','runtime','design','visibility']},
    variable:{required:['kind','type'],fields:['for','label','name.zh-CN','name.en','kind','type','group','order','value','expression','display-formula','show']},
    relation:{required:['from','to','type'],fields:['from','to','type','label','body','style']},
    view:{required:['for'],fields:['for','layout','mode','orientation','camera','preview-policy','object-visibility','zoom-policy','semantic-zoom','zoom','default-focus','position']},
    board:{required:['title','owner'],fields:['title','owner','description','width','height','frame']},
    frame:{required:['instance'],fields:['instance','x','y','width','height','z-index','order','preview-policy']},
    placement:{required:['target','parent','mode'],fields:['target','parent','mode','order','path']},
    entry:{required:[],fields:['title','knowledge','structure','content','board']},
    source:{required:['title'],fields:['title','url','body','attachment','media-type','size']}
  }
});

export function lklSchemaCatalog(){return Object.entries(LKL_SCHEMA.declarations).map(([kind,value])=>({kind,...value}))}

export function lklManualMarkdown(){
  const sections=lklSchemaCatalog().map(item=>`## ${item.kind}\n\n必填：${item.required.length?item.required.map(value=>`\`${value}\``).join('、'):'无'}\n\n字段：${item.fields.map(value=>`\`${value}\``).join('、')}`).join('\n\n');
  return`# LKL ${LKL_SCHEMA.version} 使用手册\n\n本手册由运行中的 schema 元数据生成。LKL 是数据语言；以 \`/\` 开头的是独立命令语言。\n\n${sections}\n\n## 错误诊断\n\n诊断包含行号、列号、字段路径、对象 ID 与修复建议。导入采用事务并限制对象规模。\n\n## 示例\n\n### 微积分知识包\n\n\`\`\`lkl\nlkl 2\npackage calculus {\n  title \"微积分百科\"\n  version \"1.0\"\n  language \"zh-CN\"\n  root knowledge math\n  defaultEntry calculus-board\n}\nknowledge math { title \"数学\" }\nknowledge calculus { title \"微积分（数学分析）\" body markdown \"# 极限、导数、积分与级数\" }\nboard calculus-board {\n  title \"微积分结构画板\"\n  owner math\n}\n\`\`\`\n\n### 模 12 排盘\n\n\`\`\`lkl\nstructure-instance chart {\n  using builtin:mod-n\n  owner calendar\n  parameter modulus = 12\n  variable hour { kind \"input\" type \"integer\" value 7 group \"时间\" }\n  variable wenchang { kind \"derived\" type \"integer\" expression \"-(hour + 2)\" group \"辅星\" show true }\n}\n\`\`\``;
}
