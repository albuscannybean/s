export class FormulaSyntaxError extends Error{
  constructor(message,token){super(`${message} at ${token?.line??1}:${token?.column??1}`);this.name='FormulaSyntaxError';this.line=token?.line??1;this.column=token?.column??1}
}

export function tokenizeFormula(source){
  const tokens=[];let index=0,line=1,column=1;
  const push=(type,value,startLine=line,startColumn=column)=>tokens.push({type,value,line:startLine,column:startColumn});
  while(index<source.length){const char=source[index];if(/\s/.test(char)){if(char==='\n'){line++;column=1}else column++;index++;continue}
    const startLine=line,startColumn=column;
    if(/[0-9]/.test(char)||(char==='.'&&/[0-9]/.test(source[index+1]))){let raw='';while(index<source.length&&/[0-9.eE+-]/.test(source[index])){if((source[index]=='+'||source[index]=='-')&&!/[eE]$/.test(raw))break;raw+=source[index++];column++}const value=Number(raw);if(!Number.isFinite(value))throw new FormulaSyntaxError(`Invalid number ${raw}`,{line:startLine,column:startColumn});push('number',value,startLine,startColumn);continue}
    if(/[A-Za-z_\u4e00-\u9fff]/.test(char)){let value='';while(index<source.length&&/[A-Za-z0-9_\u4e00-\u9fff]/.test(source[index])){value+=source[index++];column++}push('identifier',value,startLine,startColumn);continue}
    if('+-*/%(),'.includes(char)){push(char,char,startLine,startColumn);index++;column++;continue}
    throw new FormulaSyntaxError(`Unexpected character ${char}`,{line:startLine,column:startColumn});
  }
  tokens.push({type:'eof',value:'',line,column});return tokens;
}

const binaryOps={'+':'add','-':'subtract','*':'multiply','/':'divide','%':'%'};
export function parseFormula(source){
  const tokens=tokenizeFormula(String(source??''));let cursor=0;const peek=()=>tokens[cursor],take=type=>{const token=peek();if(token.type!==type)throw new FormulaSyntaxError(`Expected ${type}, found ${token.type}`,token);cursor++;return token};
  function primary(){const token=peek();if(token.type==='number'){cursor++;return{value:token.value}}if(token.type==='identifier'){cursor++;const name=token.value;if(peek().type!=='(')return{var:name};take('(');const args=[];if(peek().type!==')'){do{args.push(expression())}while(peek().type===','&&(cursor++,true))}take(')');if(!['mod','if','lookup'].includes(name))throw new FormulaSyntaxError(`Unknown function ${name}`,token);return{op:name,args}}
    if(token.type==='('){cursor++;const node=expression();take(')');return node}throw new FormulaSyntaxError('Expected a number, variable, or function',token)}
  function unary(){if(peek().type==='-'){cursor++;return{op:'negate',args:[unary()]}}if(peek().type==='+'){cursor++;return unary()}return primary()}
  function product(){let node=unary();while(['*','/','%'].includes(peek().type)){const op=peek().type;cursor++;node={op:binaryOps[op],args:[node,unary()]}}return node}
  function expression(){let node=product();while(['+','-'].includes(peek().type)){const op=peek().type;cursor++;node={op:binaryOps[op],args:[node,product()]}}return node}
  const ast=expression();if(peek().type!=='eof')throw new FormulaSyntaxError(`Unexpected token ${peek().value}`,peek);return ast;
}

export function formulaDependencies(ast,result=new Set()){if(ast&&typeof ast==='object'){if(ast.var)result.add(ast.var);for(const arg of ast.args??[])formulaDependencies(arg,result)}return result}

export function validateFormula(source,available=[]){try{const ast=parseFormula(source),dependencies=[...formulaDependencies(ast)],known=new Set(available),unknown=dependencies.filter(name=>!known.has(name));return{valid:!unknown.length,ast,dependencies,errors:unknown.map(name=>`Unknown variable: ${name}`)}}catch(error){return{valid:false,ast:null,dependencies:[],errors:[error.message],line:error.line,column:error.column}}
}

export function formulaCompletions(prefix,available=[]){const builtins=['mod','if','lookup'];return[...available,...builtins].filter(name=>name.toLowerCase().startsWith(String(prefix).toLowerCase())).sort()}

export function serializeFormula(ast,parentPrecedence=0){
  if('value'in ast)return String(ast.value);if('var'in ast)return ast.var;if(ast.op==='negate')return`-${serializeFormula(ast.args[0],3)}`;
  const symbols={add:[' + ',1],subtract:[' - ',1],multiply:[' * ',2],divide:[' / ',2],'%':[' % ',2]};if(symbols[ast.op]){const[symbol,precedence]=symbols[ast.op],text=ast.args.map(arg=>serializeFormula(arg,precedence)).join(symbol);return precedence<parentPrecedence?`(${text})`:text}
  return`${ast.op}(${(ast.args??[]).map(arg=>serializeFormula(arg)).join(', ')})`;
}
