export class Lkl2SyntaxError extends Error{
  constructor(message,token={line:1,column:1}){super(message);this.name='Lkl2SyntaxError';this.line=token.line;this.column=token.column;this.objectId=null;this.field=null}
}

const punctuation=Object.freeze({'{':'lbrace','}':'rbrace','[':'lbracket',']':'rbracket','=':'equals',',':'comma'});

export function lexLkl2(source){
  const input=String(source??''),tokens=[];let index=0,line=1,column=1;
  const push=(type,value,startLine=line,startColumn=column)=>tokens.push({type,value,line:startLine,column:startColumn});
  const advance=()=>{const char=input[index++];if(char==='\n'){line++;column=1}else column++;return char};
  while(index<input.length){const char=input[index];
    if(char===' '||char==='\t'||char==='\r'){advance();continue}
    if(char==='\n'){push('newline','\n');advance();continue}
    if(char==='#'||char==='/'&&input[index+1]==='/'){while(index<input.length&&input[index]!=='\n')advance();continue}
    const startLine=line,startColumn=column;
    if(input.startsWith('"""',index)){advance();advance();advance();let value='';while(index<input.length&&!input.startsWith('"""',index))value+=advance();if(index>=input.length)throw new Lkl2SyntaxError('Unterminated multiline string',{line:startLine,column:startColumn});advance();advance();advance();push('string',value,startLine,startColumn);continue}
    if(char==='"'){advance();let value='';while(index<input.length&&input[index]!=='"'){if(input[index]==='\\'){advance();const escaped=advance();value+=({n:'\n',r:'\r',t:'\t','"':'"','\\':'\\'}[escaped]??escaped)}else value+=advance()}if(input[index]!=='"')throw new Lkl2SyntaxError('Unterminated string',{line:startLine,column:startColumn});advance();push('string',value,startLine,startColumn);continue}
    if(punctuation[char]){push(punctuation[char],char,startLine,startColumn);advance();continue}
    let value='';while(index<input.length&&!/[\s{}\[\]=,"]/u.test(input[index]))value+=advance();
    if(!value)throw new Lkl2SyntaxError(`Unexpected character ${char}`,{line:startLine,column:startColumn});
    if(/^-?\d+(?:\.\d+)?$/.test(value))push('number',Number(value),startLine,startColumn);else if(value==='true'||value==='false')push('boolean',value==='true',startLine,startColumn);else if(value==='null')push('null',null,startLine,startColumn);else push('word',value,startLine,startColumn);
  }
  push('eof',null,line,column);return tokens;
}
