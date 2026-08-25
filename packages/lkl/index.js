export {lexLkl,LklSyntaxError} from './lexer.js';
export {parseLkl} from './parser.js';
export {serializeLkl} from './serializer.js';
export {validateLklDefinition} from './semantic.js';
import {parseLkl} from './parser.js';import {validateLklDefinition} from './semantic.js';
export function importLkl(source){try{return validateLklDefinition(parseLkl(source))}catch(error){return{valid:false,errors:[{message:error.message,line:error.line,column:error.column}],definition:null}}}
