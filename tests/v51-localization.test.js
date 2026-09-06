import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translateUI,translateUIFragment,systemRelationLabel,contentTypeLabel,ensureBuiltinLocalizedRecord} from '../packages/ui/localization.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {lklManualMarkdown} from '../packages/lkl2/schema.js';

test('all visible builtins have readable English names, descriptions and parameter captions',()=>{
 for(const template of BUILTIN_TEMPLATES.filter(item=>!item.hidden)){
  for(const value of[template.nameI18n.en,template.descriptionI18n.en,...template.parameters.flatMap(parameter=>[parameter.labelI18n.en,...(parameter.options??[]).filter(option=>typeof option==='object').map(option=>option.labelI18n.en)])]){
   assert.ok(value,template.id);assert.doesNotMatch(value,/[\u4e00-\u9fff]/,template.id+' '+value);
  }
 }
});
test('metadata localization preserves IDs, parameter defaults and mathematical definitions',()=>{
 const template={id:'builtin:coordinate-plane',name:'向量空间 Vector Space',description:'统一二维/三维向量、点、参数曲线、动态点与曲面的无限作图工作台。',parameters:[{id:'dimension',label:'维数',defaultValue:'3d'}],slots:[{id:'custom:甲',label:'用户标题'}],edges:[{id:'e1',label:'localize'}]};
 const localized=ensureBuiltinLocalizedRecord(template);
 assert.equal(localized.id,template.id);assert.deepEqual(localized.slots,template.slots);assert.deepEqual(localized.edges,template.edges);assert.equal(localized.parameters[0].defaultValue,'3d');assert.equal(template.nameI18n,undefined);
});
test('static UI fragments translate captions without changing markup identifiers or interpolation values',()=>{
 const raw='<button id="node" class="knowledge" data-action="definition" title="添加内容">结构设置</button>';
 assert.equal(translateUIFragment(raw,'en'),'<button id="node" class="knowledge" data-action="definition" title="Add content">Structure settings</button>');
 const userTitle='Knowledge 定义 <x>';const parts=['<h3>结构参数</h3><p>','</p>'];
 const output=parts.map((part,i)=>translateUIFragment(part,'en')+(i===0?userTitle:'')).join('');
 assert.ok(output.includes(userTitle));assert.equal(translateUI('User-authored Knowledge','zh-CN'),'User-authored Knowledge');
 assert.equal(contentTypeLabel('proof','zh-CN'),'证明');
});
test('relation display vocabulary is localized without changing unknown content or identity',()=>{
 const relation={id:'edge:a-b:1',type:'implies',label:'localize'},snapshot=structuredClone(relation);
 assert.equal(systemRelationLabel(relation.label,'zh-CN'),'局部化');assert.deepEqual(relation,snapshot);
 assert.equal(systemRelationLabel('用户的 localize 标签','zh-CN'),'用户的 localize 标签');
 assert.equal(systemRelationLabel('not-sufficient','en'),'Not sufficient');
});
test('the English guide has a full tutorial and schema reference',()=>{
 const guide=lklManualMarkdown('en');assert.match(guide,/# LKL guide/);assert.match(guide,/## 8\. For AI authors/);assert.match(guide,/preview-policy/);assert.match(guide,/## geometry/);assert.doesNotMatch(guide,/[\u4e00-\u9fff]/);
 assert.match(lklManualMarkdown(),/不可|不能等价替代/);
});
test('static language markers do not target runtime or user titles',()=>{
 const html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
 for(const id of['blankKnowledgeTitle','panelTitle','configTitle','textPromptTitle','pickerTitle','sourceWorkbenchTitle']){
  const tag=html.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'))?.[0];assert.ok(tag,id);assert.doesNotMatch(tag,/\sdata-i18n=/,id);
 }
 assert.match(html,/data-i18n-placeholder="筛选当前列表"/);
});

