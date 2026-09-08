import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNavigatorIndex,contentNavigatorKeys,flattenNavigator,searchNavigatorIndex} from '../packages/navigation/location-index.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {createStructureInstance,bindTarget} from '../packages/structure-engine/model.js';

const template=BUILTIN_TEMPLATES.find(t=>t.id==='builtin:directed-graph');
function fixture(){const instance=createStructureInstance(template);return{knowledge:[],structureInstances:[instance],structureTemplates:[template],contentObjects:[{id:'unassigned-note',title:'Blank note',body:''}]};}
function outline(state){const index=buildNavigatorIndex(state),visibleKeys=contentNavigatorKeys(index);return{index,visibleKeys,rows:flattenNavigator(index,{expanded:new Set(index.objects.keys()),visibleKeys})};}

test('content outline hides empty diagram positions while retaining independent blank content and canonical addresses',()=>{
 const state=fixture(),{index,rows}=outline(state),instance=state.structureInstances[0];
 assert.ok(index.find({kind:'slot',instanceId:instance.id,id:'A'}));
 assert.ok([...index.objects.values()].some(e=>e.kind==='relation'));
 assert.deepEqual(rows.map(e=>e.kind).sort(),['content','structure']);
 assert.equal(rows.find(e=>e.kind==='structure').expandable,false);
 const label=index.find({kind:'slot',instanceId:instance.id,id:'A'}).label;
 assert.ok(searchNavigatorIndex(index,label).some(e=>e.kind==='slot'));
 assert.equal(flattenNavigator(index,{query:label,visibleKeys:contentNavigatorKeys(index)}).some(e=>e.kind==='slot'),false);
});

test('filled positions, relation documents and their containing groups remain visible with correct child counts',()=>{
 const state=fixture(),instance=state.structureInstances[0];
 instance.containers.A.content.body='An authored explanation';
 const relationId=template.edges[0].id;instance.overrides.edgePatches[relationId]={objectContent:{body:'Evidence for this connection'}};
 const {index,rows}=outline(state),relation=rows.find(e=>e.kind==='relation');
 assert.equal(relation.id,relationId);
 assert.equal(rows.filter(e=>e.kind==='slot').length,1);
 assert.equal(rows.find(e=>e.kind==='group').childCount,1);
 assert.equal(rows.find(e=>e.kind==='structure').childCount,2);
 assert.ok(index.find({kind:'slot',instanceId:instance.id,id:'B'}));
});

test('content references keep both ancestor paths visible without revealing unrelated empty slots',()=>{
 const state=fixture(),instance=state.structureInstances[0];state.knowledge.push({id:'filled',title:'Attached knowledge',content:'Body'});
 bindTarget(instance,template,'A','knowledge','filled',{placementMode:'construct'});
 bindTarget(instance,template,'B','knowledge','filled',{placementMode:'reference'});
 const {rows}=outline(state);
 assert.deepEqual(rows.filter(e=>e.kind==='slot').map(e=>e.id),['A','B']);
 assert.equal(rows.filter(e=>e.kind==='knowledge'&&e.id==='filled').length,2);
 assert.equal(rows.filter(e=>e.kind==='relation').length,0);
});
