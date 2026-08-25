import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateExpression} from '../packages/structure-engine/evaluator.js';
import {formulaDependencies,parseFormula,serializeFormula,validateFormula} from '../packages/structure-engine/formula.js';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {importLkl,lexLkl,parseLkl,serializeLkl} from '../packages/lkl/index.js';

test('formula parser creates safe AST with unary minus, precedence and mod',()=>{const ast=parseFormula('mod(-(hour + 2), 12)');assert.equal(evaluateExpression(ast,{hour:7}),3);assert.deepEqual([...formulaDependencies(ast)],['hour']);assert.equal(serializeFormula(ast),'mod(-(hour + 2), 12)')});
test('formula validation reports unknown variables and exact syntax location',()=>{assert.deepEqual(validateFormula('hour + offset',['hour']).errors,['Unknown variable: offset']);const invalid=validateFormula('mod(hour +, 12)',['hour']);assert.equal(invalid.valid,false);assert.equal(typeof invalid.column,'number');assert.throws(()=>parseFormula('globalThis.alert(1)'),/Unexpected character/)});
test('LKL lexer carries line and column and aliases parse into the domain',()=>{const source='lkl 1\ngraph "custom:g" "G"\ncategory "graph"\nlayout "grid" "{}"\nnode "a" "A" "node" "many" "knowledge" "{}"\nend\n',tokens=lexLkl(source),definition=parseLkl(source);assert.equal(tokens.find(token=>token.value==='node').line,5);assert.equal(definition.slots[0].id,'a')});
test('LKL serializer is stable and round trips a real structure',()=>{const template={...structuredClone(getBuiltinTemplate('builtin:tree')),id:'custom:tree',builtin:false},first=serializeLkl(template),imported=importLkl(first);assert.equal(imported.valid,true);const second=serializeLkl(imported.definition);assert.equal(second,first);assert.equal(imported.definition.edges[0].sourceSlotId,'root')});
