import katex from '../../apps/web/vendor/katex/katex.mjs';

export const MATH_RENDERER_ID='katex-local-0.16.25';

export function renderMathToString(source,{display=false}={}){
  const latex=String(source??'');
  try{return{ok:true,source:latex,html:katex.renderToString(latex,{displayMode:display,throwOnError:true,strict:'warn',trust:false,output:'htmlAndMathml'})}}
  catch(error){return{ok:false,source:latex,error,html:''}}
}

export function createMathElement(documentRef,source,{display=false}={}){
  const result=renderMathToString(source,{display}),shell=documentRef.createElement(display?'div':'span');shell.className=display?'math-typeset math-display-katex':'math-typeset math-inline-katex';shell.dataset.mathRenderer=MATH_RENDERER_ID;shell.dataset.mathSource=String(source??'');
  if(result.ok)shell.innerHTML=result.html;else{shell.classList.add('math-render-error');shell.textContent=String(source??'');shell.title=`公式无法渲染：${result.error?.message??'未知错误'}`;shell.setAttribute('aria-invalid','true')}
  return shell;
}

export function renderMath(root,source,options={}){root.replaceChildren(createMathElement(root.ownerDocument,source,options));return root}

// V4.1.x compatibility exports. KaTeX remains the sole renderer.
export function tokenizeMath(source){return[{type:'latex',value:String(source??'')}]}
export function parseMathExpression(source){const value=String(source??''),children=[];if(/\\frac\s*\{/.test(value))children.push({type:'fraction',source:value});children.push({type:'latex',value});return{type:'sequence',source:value,renderer:MATH_RENDERER_ID,children}}

export function tokenizeInline(source){
  const result=[];let index=0,text='';const flush=()=>{if(text){result.push({type:'text',value:text});text=''}};
  while(index<source.length){
    if(source.startsWith('**',index)){const end=source.indexOf('**',index+2);if(end>=0){flush();result.push({type:'strong',value:source.slice(index+2,end)});index=end+2;continue}}
    if(source[index]==='`'){const end=source.indexOf('`',index+1);if(end>=0){flush();result.push({type:'code',value:source.slice(index+1,end)});index=end+1;continue}}
    if(source[index]==='['){const middle=source.indexOf('](',index+1),end=middle>=0?source.indexOf(')',middle+2):-1;if(middle>=0&&end>=0){flush();result.push({type:'link',value:source.slice(index+1,middle),href:source.slice(middle+2,end)});index=end+1;continue}}
    if(source[index]==='$'&&source[index+1]!=='$'){const end=source.indexOf('$',index+1);if(end>=0){flush();result.push({type:'math',value:source.slice(index+1,end)});index=end+1;continue}}
    text+=source[index++];
  }
  flush();return result;
}

export function appendInlineContent(root,source,documentRef=root.ownerDocument){
  for(const token of tokenizeInline(String(source??''))){
    if(token.type==='text')root.append(documentRef.createTextNode(token.value));
    else if(token.type==='math')root.append(createMathElement(documentRef,token.value));
    else if(token.type==='link'){const element=documentRef.createElement('a');element.textContent=token.value;element.href=token.href;element.rel='noopener noreferrer';root.append(element)}
    else{const element=documentRef.createElement(token.type==='strong'?'strong':'code');element.textContent=token.value;root.append(element)}
  }return root;
}

export function parseStudyMarkdown(source){
  const lines=String(source??'').replace(/\r/g,'').split('\n'),blocks=[];let index=0,paragraph=[];
  const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join(' ')});paragraph=[]}};
  while(index<lines.length){const line=lines[index];
    if(/^\`\`\`/.test(line)){flush();const language=line.slice(3).trim(),body=[];index++;while(index<lines.length&&!/^\`\`\`/.test(lines[index]))body.push(lines[index++]);index++;blocks.push({type:'code',language,text:body.join('\n')});continue}
    const study=line.match(/^:::\s*(definition|theorem|example|proof)\s*$/i);if(study){flush();const body=[];index++;while(index<lines.length&&!/^:::\s*$/.test(lines[index]))body.push(lines[index++]);index++;blocks.push({type:'study',kind:study[1].toLowerCase(),text:body.join('\n').trim()});continue}
    if(line.trim().startsWith('$$')){flush();const body=[],single=line.trim().slice(2);if(single.endsWith('$$')&&single.length>2){blocks.push({type:'math',text:single.slice(0,-2).trim()});index++;continue}if(single)body.push(single);index++;while(index<lines.length&&!lines[index].trim().endsWith('$$'))body.push(lines[index++]);if(index<lines.length){body.push(lines[index].trim().slice(0,-2));index++}blocks.push({type:'math',text:body.join('\n').trim()});continue}
    const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){flush();blocks.push({type:'heading',level:heading[1].length,text:heading[2]});index++;continue}
    if(/^>\s?/.test(line)){flush();blocks.push({type:'quote',text:line.replace(/^>\s?/, '')});index++;continue}
    const list=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);if(list){flush();const ordered=/^\s*\d+\./.test(line),items=[];while(index<lines.length){const match=lines[index].match(ordered?/^\s*\d+\.\s+(.+)$/:/^\s*[-*]\s+(.+)$/);if(!match)break;items.push(match[1]);index++}blocks.push({type:'list',ordered,items});continue}
    if(!line.trim()){flush();index++;continue}paragraph.push(line.trim());index++;
  }
  flush();return blocks;
}

export function renderMarkdownDocument(root,source,documentRef=root.ownerDocument){
  root.replaceChildren();const labels={definition:'定义',theorem:'定理',example:'例',proof:'证明'};
  for(const block of parseStudyMarkdown(source)){let element;
    if(block.type==='heading'){element=documentRef.createElement(`h${block.level}`);appendInlineContent(element,block.text,documentRef)}
    else if(block.type==='paragraph'){element=documentRef.createElement('p');appendInlineContent(element,block.text,documentRef)}
    else if(block.type==='quote'){element=documentRef.createElement('blockquote');appendInlineContent(element,block.text,documentRef)}
    else if(block.type==='math'){element=documentRef.createElement('div');element.className='math-display';element.append(createMathElement(documentRef,block.text,{display:true}))}
    else if(block.type==='code'){element=documentRef.createElement('pre');element.className='study-code';const code=documentRef.createElement('code');code.textContent=block.text;element.append(code)}
    else if(block.type==='list'){element=documentRef.createElement(block.ordered?'ol':'ul');for(const item of block.items){const li=documentRef.createElement('li');appendInlineContent(li,item,documentRef);element.append(li)}}
    else if(block.type==='study'){element=documentRef.createElement('section');element.className=`study-block study-${block.kind}`;const title=documentRef.createElement('strong');title.textContent=labels[block.kind]??block.kind;const body=documentRef.createElement('div');for(const line of block.text.split('\n')){const paragraph=documentRef.createElement('p');appendInlineContent(paragraph,line,documentRef);body.append(paragraph)}element.append(title,body)}
    if(element)root.append(element);
  }return root;
}

export const renderStudyMarkdown=renderMarkdownDocument;
