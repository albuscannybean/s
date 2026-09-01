import {parseLkl2} from './parser.js';
import {compileLkl2Ast} from './ast.js';
import {validateKnowledgePackage} from './validator.js';
export {lexLkl2,Lkl2SyntaxError} from './lexer.js';
export {parseLkl2} from './parser.js';
export {compileLkl2Ast} from './ast.js';
export {validateKnowledgePackage} from './validator.js';
export {serializeKnowledgePackage,semanticEquivalent} from './serializer.js';
export {serializeStructureInstance,parseStructureInstanceSource,applyStructureInstanceDraft,formatStructureInstanceSource,serializeStructureTemplateDefaults,parseStructureTemplateDefaultsSource} from './structure-source.js';
export {buildImportPlan,commitImportPlan,countModel,previewTree} from './importer.js';
export {exportStateKnowledgePackage} from './exporter.js';

export function detectLklVersion(source){const match=String(source??'').match(/^\s*lkl\s+(\d+)/i);return match?Number(match[1]):null}
export function importKnowledgePackage(source,options={}){try{const ast=parseLkl2(source),model=compileLkl2Ast(ast),validation=validateKnowledgePackage(model,options);model.validation=validation;return{valid:validation.valid,ast,package:model,errors:validation.errors,warnings:validation.warnings,diagnostics:validation.diagnostics}}catch(error){const diagnostic={severity:'error',message:error.message,line:error.line??1,column:error.column??1,objectId:error.objectId??null,field:error.field??null,suggestion:null};return{valid:false,ast:null,package:null,errors:[diagnostic],warnings:[],diagnostics:[diagnostic]}}}
