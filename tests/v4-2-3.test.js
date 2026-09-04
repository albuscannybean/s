import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUILTIN_TEMPLATES,getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {buildSceneGeometry,projectCoordinate} from '../packages/geometry/scene-geometry.js';
import {PLOT_PRESETS,parsePlotExpression,samplePlotExpression} from '../packages/structure-engine/plotting.js';
import {VariableSchemeRepository,ensureVariableSchemes} from '../packages/structure-engine/variable-schemes.js';
import {libraryEntries,librarySection} from '../packages/ui/library-model.js';
import {migrateV3ToV4} from '../packages/structure-engine/migration.js';

test('V4.2.3 parameterized plots expose editable parameters and reject bare preset words',()=>{
  const circle=parsePlotExpression('circle(cx=2, cy=-1, r=4)');
  assert.deepEqual(circle.primitive,{type:'circle',parameters:{cx:2,cy:-1,r:4}});
  assert.ok(samplePlotExpression(PLOT_PRESETS.heart.source).segments.flat().length>200);
  assert.equal(parsePlotExpression(PLOT_PRESETS.helix.source).dimension,'3d');
  assert.throws(()=>parsePlotExpression('circle'),/显式参数/);
});

test('3D projection uses a conventional upward z axis and coordinate points stay compact',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'k',{dimension:'3d',scale:40}),origin=projectCoordinate({},instance),z=projectCoordinate({z:3},instance),scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance);
  assert.equal(z.x,origin.x);assert.ok(z.y<origin.y);
  assert.ok(scene.nodes.every(node=>node.width<=11&&node.height<=11));
  assert.ok(scene.background.filter(item=>item.className?.includes('coordinate-grid-3d')).length>20);
});

test('every visible built-in structure can materialize and build a scene',()=>{
  const visible=libraryEntries({structureTemplates:BUILTIN_TEMPLATES});
  assert.ok(visible.length>20);
  for(const template of visible){const instance=createStructureInstance(template,'knowledge');const definition=materializeInstanceDefinition(template,instance);assert.doesNotThrow(()=>buildSceneGeometry(definition,instance),template.id);assert.notEqual(librarySection(template),'experimental',template.id)}
  const mapping=getBuiltinTemplate('builtin:function-mapping'),mappingScene=buildSceneGeometry(materializeInstanceDefinition(mapping,createStructureInstance(mapping,'k')),createStructureInstance(mapping,'k'));
  assert.equal(mappingScene.background.some(item=>item.className?.includes('lmn-column-title')),false);
});

test('LMN N channel sends symbolization and structuring into the paired M layers',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template,'k'),definition=materializeInstanceDefinition(template,instance);buildSceneGeometry(definition,instance);
  assert.deepEqual(definition.edges.filter(item=>['e7','e8','e9','e10'].includes(item.id)).map(item=>[item.sourceSlotId,item.targetSlotId,item.direction]),[['N1','M1','directed'],['N1','M2','directed'],['N2','M2','directed'],['N2','M3','directed']]);
});

test('built-in variable schemes allow edited defaults and persistent deletion tombstones',()=>{
  const repository=new VariableSchemeRepository(),id=repository.list({category:'builtin'})[0].id;
  repository.update(id,{parameters:{modulus:17},description:'edited'});
  assert.equal(repository.get(id).parameters.modulus,17);
  repository.remove(id);
  assert.equal(repository.get(id),null);
  assert.equal(ensureVariableSchemes(repository.schemes).some(item=>item.id===id&&!item.deleted),false);
});

test('built-in template visual defaults survive migration while current topology is refreshed',()=>{
  const builtin=structuredClone(getBuiltinTemplate('builtin:directed-graph'));builtin.visual={...builtin.visual,nodeFill:'#abcdef',relationStyle:{color:'#123456'}};
  const migrated=migrateV3ToV4({schemaVersion:4,knowledge:[],relations:[],representations:[],structureTemplates:[builtin],structureInstances:[],variableSchemes:[]}),template=migrated.structureTemplates.find(item=>item.id===builtin.id);
  assert.equal(template.visual.nodeFill,'#abcdef');assert.equal(template.visual.relationStyle.color,'#123456');assert.equal(template.version,getBuiltinTemplate(builtin.id).version);
});

test('V4.2.3+ source contains synchronized find scrolling, one settings tab, and three navigation modes',()=>{
  const controller=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
  assert.match(html,/V4\.3\.[012](?: RC)?/);
  assert.equal((html.match(/data-navigator=/g)??[]).length,3);
  assert.doesNotMatch(html,/data-navigator="knowledge"/);
  assert.match(controller,/scrollSourceSelectionIntoView/);
  assert.match(controller,/\['settings','设置'\]/);
  assert.doesNotMatch(controller,/\['view','呈现'\],\['parameters','参数'\]/);
  assert.match(controller,/nav-other-knowledge/);
});
