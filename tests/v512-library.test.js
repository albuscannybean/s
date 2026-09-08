import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryDeletionPlan,applyLibraryDeletion} from '../packages/ui/structure-library-actions.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {createStructureInstance} from '../packages/structure-engine/model.js';
import {createVariableScheme,ensureVariableSchemes} from '../packages/structure-engine/variable-schemes.js';
test('library deletion preserves in-use models, removes unused templates and keeps builtin schemes deleted on reload',()=>{
 const template={...structuredClone(BUILTIN_TEMPLATES[0]),id:'custom:used',builtin:false},unused={...structuredClone(template),id:'custom:unused'},instance=createStructureInstance(template),custom=createVariableScheme('My scheme',instance),schemes=ensureVariableSchemes([custom]),builtin=schemes.find(s=>s.builtin);
 const state={structureTemplates:[...structuredClone(BUILTIN_TEMPLATES),template,unused],structureInstances:[instance],variableSchemes:schemes};
 const before=structuredClone(state),plan=libraryDeletionPlan(state,[{kind:'template',id:template.id},{kind:'template',id:unused.id},{kind:'scheme',id:custom.id},{kind:'scheme',id:builtin.id},{kind:'template',id:BUILTIN_TEMPLATES[0].id}]);
 assert.equal(plan.count,4);applyLibraryDeletion(state,plan);
 assert.deepEqual(state.structureInstances,before.structureInstances);
 assert.equal(state.structureTemplates.find(t=>t.id===template.id).hidden,true);
 assert.equal(state.structureTemplates.some(t=>t.id===unused.id),false);
 assert.equal(state.structureTemplates.find(t=>t.id===BUILTIN_TEMPLATES[0].id).hidden,before.structureTemplates[0].hidden);
 assert.equal(ensureVariableSchemes(state.variableSchemes).find(s=>s.id===builtin.id).deleted,true);
 assert.equal(state.variableSchemes.some(s=>s.id===custom.id),false);
 assert.equal(before.structureTemplates.find(t=>t.id===template.id).hidden,undefined);
});

