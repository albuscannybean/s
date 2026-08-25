import {lexLkl,LklSyntaxError} from './lexer.js';
const aliases={node:'slot',relation:'edge',graph:'structure'};
const json=(value,token)=>{try{return JSON.parse(value)}catch{throw new LklSyntaxError('Invalid JSON value',token.line,token.column)}};
export function parseLkl(source){const tokens=lexLkl(source),lines=[];let line=[];for(const token of tokens){if(token.type==='newline'||token.type==='eof'){if(line.length)lines.push(line);line=[]}else line.push(token)}if(!lines.length)throw new LklSyntaxError('Empty LKL document');let cursor=0;const header=lines[cursor++];if(header[0]?.value!=='lkl'||Number(header[1]?.value)!==1)throw new LklSyntaxError('Expected lkl 1 header',header[0]?.line,header[0]?.column);const definition={version:1,builtin:false,nestable:true,computable:false,slots:[],edges:[],parameters:[],variables:[],constraints:[],rules:[],layout:{type:'manual'},visual:{accent:'#596B63'}};let ended=false;
  for(;cursor<lines.length;cursor++){const row=lines[cursor],command=aliases[row[0].value]??row[0].value,args=row.slice(1);const requireCount=count=>{if(args.length<count)throw new LklSyntaxError(`${command} expects ${count} values`,row[0].line,row[0].column)};
    if(command==='structure'){requireCount(2);definition.id=args[0].value;definition.name=args[1].value}
    else if(command==='description'){requireCount(1);definition.description=args[0].value}
    else if(command==='category'){requireCount(1);definition.category=args[0].value}
    else if(command==='layout'){requireCount(1);definition.layout={type:args[0].value,...(args[1]?json(args[1].value,args[1]):{})}}
    else if(command==='visual'){requireCount(1);definition.visual=json(args[0].value,args[0])}
    else if(command==='flags'){requireCount(1);const flags=json(args[0].value,args[0]);definition.nestable=flags.nestable??true;definition.computable=flags.computable??false}
    else if(command==='parameter'){requireCount(5);definition.parameters.push({id:args[0].value,label:args[1].value,type:args[2].value,defaultValue:json(args[3].value,args[3]),...json(args[4].value,args[4])})}
    else if(command==='variable'){requireCount(7);definition.variables.push({id:args[0].value,label:args[1].value,type:args[2].value,kind:args[3].value,value:json(args[4].value,args[4]),formula:args[5].value,expression:json(args[6].value,args[6])})}
    else if(command==='slot'){requireCount(6);definition.slots.push({id:args[0].value,label:args[1].value,role:args[2].value,cardinality:args[3].value,accepts:args[4].value.split(',').filter(Boolean),semanticCoordinate:json(args[5].value,args[5])})}
    else if(command==='edge'){requireCount(9);definition.edges.push({id:args[0].value,sourceSlotId:args[1].value,targetSlotId:args[2].value,direction:args[3].value,relationType:args[4].value,label:args[5].value,routing:args[6].value,semanticAxis:args[7].value||null,visual:json(args[8].value,args[8])})}
    else if(command==='constraint'){requireCount(1);definition.constraints.push(json(args[0].value,args[0]))}
    else if(command==='rule'){requireCount(1);definition.rules.push(json(args[0].value,args[0]))}
    else if(command==='factory'){requireCount(1);definition.slotFactory=args[0].value}
    else if(command==='end'){ended=true;break}
    else throw new LklSyntaxError(`Unknown directive ${row[0].value}`,row[0].line,row[0].column)}
  if(!definition.id||!definition.name)throw new LklSyntaxError('Structure id and name are required');if(!ended)throw new LklSyntaxError('Expected end directive',tokens.at(-1).line,tokens.at(-1).column);return definition}
