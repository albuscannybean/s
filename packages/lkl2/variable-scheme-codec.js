import {parseLkl2} from './parser.js';
import {compileLkl2Ast} from './ast.js';
import {serializeKnowledgePackage} from './serializer.js';

export function serializeVariableSchemeLkl2(scheme){return serializeKnowledgePackage({package:{stableId:`scheme-package:${scheme.id}`,title:scheme.title??scheme.name,version:'1.0',root:null},knowledge:[],contents:[],structureTemplates:[],structureInstances:[],relations:[],variables:[],variableSchemes:[scheme],views:[],entries:[],sources:[]})}
export function parseVariableSchemeLkl2(source){const model=compileLkl2Ast(parseLkl2(source)),scheme=model.variableSchemes?.[0];if(!scheme)throw new Error('LKL 2 source does not contain a variable-scheme block');return scheme}
