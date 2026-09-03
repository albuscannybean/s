import {lexLkl2,Lkl2SyntaxError} from './lexer.js';
import {LKL_SCHEMA} from './schema.js';

const declarationKinds=new Set([...LKL_SCHEMA.topLevelDeclarations,...Object.keys(LKL_SCHEMA.declarationAliases)]);

export function parseLkl2(source){
  const tokens=lexLkl2(source);let cursor=0;
  const current=()=>tokens[cursor],take=()=>tokens[cursor++],skipLines=()=>{while(current().type==='newline')take()};
  const expect=(type,value=null)=>{const token=current();if(token.type!==type||(value!==null&&token.value!==value))throw new Lkl2SyntaxError(`Expected ${value??type}, found ${token.value??token.type}`,token);return take()};
  const parseValue=()=>{const token=current();if(token.type==='lbracket'){take();const values=[];while(current().type!=='rbracket'){if(current().type==='comma'||current().type==='newline'){take();continue}values.push(parseValue())}take();return values}if(['word','string','number','boolean','null'].includes(token.type)){take();return token.value}throw new Lkl2SyntaxError(`Expected value, found ${token.value??token.type}`,token)};
  const parseBlock=(kind,id,loc)=>{expect('lbrace');const block={kind:LKL_SCHEMA.declarationAliases[kind]??kind,id:id??null,statements:[],children:[],loc};skipLines();while(current().type!=='rbrace'&&current().type!=='eof'){
      const keyToken=expect('word'),key=keyToken.value,values=[];while(current().type!=='newline'&&current().type!=='eof'&&current().type!=='rbrace'&&current().type!=='lbrace'){if(current().type==='equals'||current().type==='comma'){take();continue}values.push(parseValue())}
      if(current().type==='lbrace'){const childId=values.length?String(values.shift()):null;block.children.push(parseBlock(key,childId,{line:keyToken.line,column:keyToken.column}));if(current().type==='newline')take()}
      else{block.statements.push({key,values,loc:{line:keyToken.line,column:keyToken.column},objectId:id??null,field:key});if(current().type==='newline')take()}
      skipLines();
    }expect('rbrace');return block};
  skipLines();const header=expect('word','lkl'),version=expect('number');if(version.value!==2)throw new Lkl2SyntaxError(`Expected LKL 2, found ${version.value}`,version);skipLines();const declarations=[];
  while(current().type!=='eof'){const token=expect('word');if(!declarationKinds.has(token.value))throw new Lkl2SyntaxError(`Unknown top-level declaration ${token.value}`,token);let id=null;if(current().type!=='lbrace')id=String(parseValue());declarations.push(parseBlock(token.value,id,{line:token.line,column:token.column}));skipLines()}
  return{type:'Lkl2Document',version:2,declarations,source:String(source??'')};
}
