import {parseLkl2} from './parser.js';
import {parseFormula} from '../structure-engine/formula.js';
import {materializeInstanceDefinition,normalizeInstance} from '../structure-engine/model.js';
import {containerCapabilities,edgeCapabilities,getStructureInteractionAdapter} from '../structure-engine/interaction-adapters.js';
import {resolveRelationStyle,setRelationStyle} from '../structure-engine/relation-style-resolver.js';
import {validateGraphFamily} from '../structure-engine/structure-families.js';
import {LKL_ENUMS,LKL_STRUCTURE_SOURCE_SCHEMA} from './schema.js';

const clone=value=>structuredClone(value);
const quote=value=>`"${String(value??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')}"`;
const json=value=>`"""${JSON.stringify(value??{},null,2)}"""`;
const field=(name,value,indent='  ')=>`${indent}${name} ${typeof value==='number'||typeof value==='boolean'?value:quote(value)}`;

export function serializeStructureInstance(template,instance){
  normalizeInstance(instance);const definition=materializeInstanceDefinition(template,instance),lines=['lkl 2','',`structure-instance ${instance.id} {`,field('using',template.id),field('title',instance.objectContent?.title??template.name)];
  if(instance.resultSpace)lines.push(`  result-space ${json(instance.resultSpace)}`);
  for(const[key,value]of Object.entries(instance.parameters??{}))lines.push(`  parameter ${key} = ${typeof value==='number'||typeof value==='boolean'?value:quote(value)}`);
  for(const slot of definition.slots){const container=instance.containers?.[slot.id];lines.push(`  container ${slot.id} {`);if(container?.localDisplayTitle)lines.push(field('local-title',container.localDisplayTitle,'    '));if(container?.content?.title&&container.content.title!==slot.label)lines.push(field('title',container.content.title,'    '));lines.push('  }')}
  for(const variable of instance.variables??[]){lines.push(`  variable ${variable.id} {`,field('label',variable.label??variable.id,'    '),field('display-name',variable.displayName??variable.label??variable.id,'    '),field('kind',variable.kind??'input','    '),field('type',variable.type??'number','    '));if(variable.value!=null)lines.push(field('value',variable.value,'    '));if(variable.formula)lines.push(field('expression',variable.formula,'    '));if(variable.displayFormula)lines.push(field('display-formula',variable.displayFormula,'    '));lines.push(field('show',variable.showOnCanvas!==false,'    '));if(variable.resultSpace)lines.push(`    result-space ${json(variable.resultSpace)}`);lines.push('  }')}
  for(const geometry of instance.geometryPrimitives??[]){lines.push(`  geometry ${geometry.id} {`,field('type',geometry.kind,'    '));const operandSyntax=geometry.operandRefs?.length,refs=operandSyntax?geometry.operandRefs:geometry.pointRefs??[];for(const ref of refs)lines.push(`    ${operandSyntax?'operand':'point'} ${ref.type} ${ref.id}`);lines.push(field('visible',geometry.visible!==false,'    '));if(geometry.style?.color)lines.push(field('stroke',geometry.style.color,'    '));if(geometry.style?.width!=null)lines.push(field('width',geometry.style.width,'    '));if(geometry.style?.fill)lines.push(field('fill',geometry.style.fill,'    '));lines.push('  }')}
  const addedIds=new Set(instance.overrides?.addedEdges?.map(item=>item.id));for(const edge of definition.edges){const {routing,...visual}=resolveRelationStyle(edge,instance,{structureDefault:definition.visual?.relationStyle});lines.push(`  relation ${edge.id} {`,field('from',edge.sourceSlotId,'    '),field('to',edge.targetSlotId,'    '),field('direction',edge.direction??'directed','    '),field('type',edge.relationType??'related','    '));if(edge.displayLabel??edge.label)lines.push(field('label',edge.displayLabel??edge.label,'    '));lines.push(field('routing',routing,'    '));lines.push(`    style ${json(visual)}`);lines.push(field('canonical',!addedIds.has(edge.id),'    '),'  }')}
  lines.push(`  layout-state ${json(instance.layoutState)}`,`  view-state ${json(instance.structureView)}`,`  design-styles ${json(instance.designStyles)}`,`  relation-styles ${json(instance.relationStyles)}`,`  object-visibility ${json(instance.objectVisibility)}`,`  plot-expressions ${json(instance.plotExpressions)}`,`  motion-points ${json(instance.motionPoints)}`,`  topology-overrides ${json(instance.overrides)}`,'}','');return lines.join('\n')
}

export function serializeStructureTemplateDefaults(template){
  const lines=['lkl 2','',`structure-template ${template.id} {`,field('title',template.name),field('description',template.description)];
  for(const parameter of template.parameters??[])lines.push(`  parameter ${parameter.id} = ${typeof parameter.defaultValue==='number'||typeof parameter.defaultValue==='boolean'?parameter.defaultValue:quote(parameter.defaultValue)}`);
  lines.push(`  visual-defaults ${json(template.visual??{})}`,`  view-capability ${json(template.viewCapability??{})}`,'}','');return lines.join('\n');
}

export function parseStructureTemplateDefaultsSource(source,{template}={}){
  try{
    const ast=parseLkl2(source),block=ast.declarations.find(item=>item.kind==='structure-template');if(!block||ast.declarations.length!==1)throw diagnosticError('Default source requires exactly one structure-template block',{line:1,column:1},'structure-template');assertStructureSourceBlock(block);
    if(String(block.id)!==String(template.id))throw diagnosticError('Changing the built-in template identity is not supported',block.loc,'structure-template');
    const draft=clone(template),statements=groupStatements(block.statements),title=first(statements,'title'),description=first(statements,'description');if(title!==undefined)draft.name=String(title);if(description!==undefined)draft.description=String(description);
    const defaults=new Map((draft.parameters??[]).map(item=>[item.id,item]));for(const statement of statements.get('parameter')??[]){const[key,value]=statement.values;if(!defaults.has(String(key)))throw diagnosticError(`Unknown default parameter ${key}`,statement.loc,'parameter');defaults.get(String(key)).defaultValue=value}
    const visual=parseJsonField(statements,'visual-defaults',draft.visual??{}),capability=parseJsonField(statements,'view-capability',draft.viewCapability??{});if(visual!==undefined)draft.visual=visual;if(capability!==undefined)draft.viewCapability=capability;
    return{valid:true,draft,diagnostics:[],ast};
  }catch(error){return{valid:false,draft:null,diagnostics:[{severity:'error',message:error.message,line:Number(error.line??1),column:Number(error.column??1),field:error.field??null}],error}}
}

export function parseStructureInstanceSource(source,{template,instance}={}){
  try{
    const ast=parseLkl2(source),block=ast.declarations.find(item=>item.kind==='structure-instance');if(!block||ast.declarations.length!==1)throw diagnosticError('Structure source requires exactly one structure-instance block',{line:1,column:1},'structure-instance');assertStructureSourceBlock(block);
    if(String(block.id)!==String(instance.id))throw diagnosticError('Changing the instance identity is not supported',block.loc,'structure-instance');
    const original=clone(instance);normalizeInstance(original);
    const originalDefinition=materializeInstanceDefinition(template,original),originalEdges=new Map(originalDefinition.edges.map(edge=>[edge.id,edge]));
    const draft=clone(original),statements=groupStatements(block.statements),using=first(statements,'using');
    if(using&&String(using)!==String(template.id))throw diagnosticError('Changing the template reference is not supported in this workbench',statementLoc(statements,'using'),'template');
    const title=first(statements,'title');if(title!==undefined)draft.objectContent.title=String(title);
    for(const statement of statements.get('parameter')??[]){
      const[key,value]=statement.values;if(key==null||value===undefined)throw diagnosticError('parameter requires a name and value',statement.loc,'parameter');
      const parameter=template.parameters?.find(item=>item.id===String(key));if(!parameter)throw diagnosticError('Unknown parameter '+key,statement.loc,'parameter');
      if(parameter.type==='number'&&(!Number.isFinite(Number(value))||parameter.min!=null&&Number(value)<parameter.min||parameter.max!=null&&Number(value)>parameter.max))throw diagnosticError('Parameter outside its valid range: '+key,statement.loc,'parameter');
      if(parameter.options?.length&&!parameter.options.some(option=>String(option.value??option)===String(value)))throw diagnosticError('Unsupported parameter option: '+key,statement.loc,'parameter');
      draft.parameters[String(key)]=value;
    }
    // Read aggregate state first. Explicit edits below must not be overwritten by an old snapshot.
    const baseline=clone(draft),fieldMap={'result-space':'resultSpace','layout-state':'layoutState','view-state':'structureView','design-styles':'designStyles','relation-styles':'relationStyles','object-visibility':'objectVisibility','plot-expressions':'plotExpressions','motion-points':'motionPoints','topology-overrides':'overrides'};
    for(const[sourceKey,stateKey]of Object.entries(fieldMap)){const value=parseJsonField(statements,sourceKey,draft[stateKey]);if(value!==undefined)draft[stateKey]=value}
    normalizeInstance(draft);
    for(const child of block.children.filter(item=>item.kind==='container')){draft.containers[child.id]??={id:child.id,children:[]};const fields=groupStatements(child.statements),localTitle=first(fields,'local-title'),title=first(fields,'title');if(localTitle!==undefined){if(String(localTitle).trim())draft.containers[child.id].localDisplayTitle=String(localTitle).trim();else delete draft.containers[child.id].localDisplayTitle}if(title!==undefined){draft.containers[child.id].content??={};draft.containers[child.id].content.title=String(title)}}
    draft.variables=block.children.filter(item=>item.kind==='variable').map(child=>parseVariable(child,draft.resultSpace));
    const definition=materializeInstanceDefinition(template,draft),definitionEdges=new Map(definition.edges.map(edge=>[edge.id,edge])),relationIds=new Set();
    const topologyFields={from:'sourceSlotId',to:'targetSlotId',direction:'direction',type:'relationType',label:'displayLabel'};
    for(const child of block.children.filter(item=>item.kind==='relation')){
      if(relationIds.has(child.id))throw diagnosticError('Duplicate relation '+child.id,child.loc,'relation');relationIds.add(child.id);
      const fields=groupStatements(child.statements),edge=definitionEdges.get(child.id),previous=originalEdges.get(child.id);
      // A parameter change can legitimately remove generated relations from the old source.
      if(!edge){if(previous&&JSON.stringify(original.parameters)!==JSON.stringify(draft.parameters))continue;throw diagnosticError('Unknown relation '+child.id,child.loc,'relation')}
      const reference=previous??edge,patch={};
      for(const[sourceKey,edgeKey]of Object.entries(topologyFields)){
        const value=first(fields,sourceKey),oldValue=edgeKey==='displayLabel'?reference.displayLabel??reference.label??'':reference[edgeKey];
        if(value!==undefined&&String(value)!==String(oldValue??''))patch[edgeKey]=String(value);
      }
      draft.overrides.edgePatches[child.id]={...(draft.overrides.edgePatches[child.id]??{}),...patch};
      const originalStyle=resolveRelationStyle(reference,original,{structureDefault:originalDefinition.visual?.relationStyle}),routing=first(fields,'routing'),style=parseJsonField(fields,'style',{}),stylePatch={};
      if(routing!==undefined&&routing!==originalStyle.routing)stylePatch.routing=String(routing);
      for(const[key,value]of Object.entries(style??{}))if(value!==originalStyle[key])stylePatch[key]=value;
      if(stylePatch.routing&&!['straight','bezier','orthogonal','radial-arc'].includes(stylePatch.routing))throw diagnosticError('Unsupported relation routing '+stylePatch.routing,child.loc,'routing');
      if(Object.keys(stylePatch).length)setRelationStyle(draft,{scope:'edge',edgeIds:[child.id]},stylePatch);
    }
    validateSourceTopology(template,baseline,draft,statementLoc(statements,'topology-overrides'));
    const geometryBlocks=block.children.filter(item=>item.kind==='geometry'),slotIds=new Set(materializeInstanceDefinition(template,draft).slots.map(item=>item.id)),motionIds=new Set((draft.motionPoints??[]).map(item=>item.id)),geometryIds=new Set(geometryBlocks.map(item=>item.id)),plotIds=new Set((draft.plotExpressions??[]).map(item=>item.id));
    draft.geometryPrimitives=geometryBlocks.map(child=>parseGeometry(child,{slotIds,motionIds,geometryIds,plotIds}));
    normalizeInstance(draft);return{valid:true,draft,diagnostics:[],ast};
  }catch(error){return{valid:false,draft:null,diagnostics:[{severity:'error',message:error.message,line:Number(error.line??1),column:Number(error.column??1),field:error.field??null}],error}}
}

function validateSourceTopology(template,baseline,draft,loc){
  const before=materializeInstanceDefinition(template,baseline),after=materializeInstanceDefinition(template,draft),adapter=getStructureInteractionAdapter(template);
  const oldSlots=new Map(before.slots.map(item=>[item.id,item])),oldEdges=new Map(before.edges.map(item=>[item.id,item])),slots=new Set(after.slots.map(item=>item.id)),edges=new Set(after.edges.map(item=>item.id));
  const actions=adapter.getCreateActions(template,draft).filter(action=>action.kind==='topology');
  const canAddNode=actions.some(action=>!/relation/.test(action.id)),canAddEdge=actions.some(action=>/relation/.test(action.id));
  const fail=message=>{throw diagnosticError(message,loc,'topology-overrides')};
  if(slots.size!==after.slots.length||edges.size!==after.edges.length)fail('Duplicate topology identity');
  for(const slot of after.slots)if(!oldSlots.has(slot.id)&&!canAddNode)fail('Canonical topology is protected; this structure generates its own nodes');
  for(const slot of before.slots)if(!slots.has(slot.id)&&!containerCapabilities(template,slot,baseline).canDeleteCanonicalObject)fail('Canonical node '+slot.id+' topology is protected');
  for(const edge of before.edges)if(!edges.has(edge.id)&&slots.has(edge.sourceSlotId)&&slots.has(edge.targetSlotId)&&!edgeCapabilities(template,edge,baseline).canDeleteCanonicalObject)fail('Canonical relation '+edge.id+' topology is protected');
  for(const edge of after.edges){
    if(!slots.has(edge.sourceSlotId)||!slots.has(edge.targetSlotId))fail('Relation '+edge.id+' has an unknown endpoint');
    if(!['undirected','directed','bidirectional','cyclic','conditional','derived'].includes(edge.direction))fail('Unsupported relation direction '+edge.direction);
    const previous=oldEdges.get(edge.id);if(!previous){if(!canAddEdge)fail('Canonical topology is protected; this structure generates its own relations');continue}
    const capabilities=edgeCapabilities(template,previous,baseline);
    if((edge.sourceSlotId!==previous.sourceSlotId||edge.targetSlotId!==previous.targetSlotId)&&!capabilities.canChangeEndpoints||edge.direction!==previous.direction&&!capabilities.canChangeDirection||edge.relationType!==previous.relationType&&!capabilities.canChangeRelationType)fail('Canonical relation '+edge.id+' topology is protected; use relation-styles arrow to control its displayed arrow direction');
  }
  // Materialization filters removed-node relations; catch new dangling declarations before they disappear.
  for(const edge of draft.overrides.addedEdges)if(!draft.overrides.removedEdgeIds.includes(edge.id)&&(!slots.has(edge.sourceSlotId)||!slots.has(edge.targetSlotId))&&!baseline.overrides.addedEdges.some(old=>old.id===edge.id&&JSON.stringify(old)===JSON.stringify(edge)))fail('Relation '+edge.id+' has an unknown endpoint');
  const prepared=adapter.prepareDefinition(after,draft),validation=adapter.validateStructure(prepared,draft),family=validateGraphFamily(after);
  if(!validation.valid)fail(validation.errors.join('; '));if(family.length)fail(family.join('; '));
}

export function applyStructureInstanceDraft(instance,draft){for(const key of['parameters','variables','resultSpace','containers','overrides','layoutState','structureView','designStyles','relationStyles','objectVisibility','plotExpressions','motionPoints','geometryPrimitives','objectContent'])if(key in draft)instance[key]=clone(draft[key]);instance.updatedAt=new Date().toISOString();normalizeInstance(instance);return instance}
export function formatStructureInstanceSource(source,context){const parsed=parseStructureInstanceSource(source,context);return parsed.valid?{...parsed,source:serializeStructureInstance(context.template,parsed.draft)}:parsed}

function parseVariable(child,defaultResultSpace){const fields=groupStatements(child.statements),formula=String(first(fields,'expression')??''),variable={id:child.id,label:String(first(fields,'label')??child.id),displayName:String(first(fields,'display-name')??first(fields,'label')??child.id),kind:String(first(fields,'kind')??(formula?'derived':'input')),type:String(first(fields,'type')??'number'),value:first(fields,'value'),formula,expression:formula?parseFormula(formula):null,displayFormula:String(first(fields,'display-formula')??''),showOnCanvas:first(fields,'show')!==false,resultSpace:parseJsonField(fields,'result-space',defaultResultSpace)??clone(defaultResultSpace)};return variable}
function parseGeometry(child,{slotIds=new Set(),motionIds=new Set(),geometryIds=new Set(),plotIds=new Set()}={}){const fields=groupStatements(child.statements),kind=String(first(fields,'type')??'line');if(!LKL_ENUMS.geometryKinds.includes(kind))throw diagnosticError(`Unsupported geometry type ${kind}`,child.loc,'geometry.type');const pointRefs=(fields.get('point')??[]).map(statement=>({type:String(statement.values[0]??''),id:String(statement.values[1]??'')})),declaredOperands=(fields.get('operand')??[]).map(statement=>({type:String(statement.values[0]??''),id:String(statement.values[1]??'')})),operandRefs=declaredOperands.length?[...pointRefs,...declaredOperands]:pointRefs,pointLike=operandRefs.filter(ref=>LKL_ENUMS.legacyGeometryPointTypes.includes(ref.type));if(kind==='line'&&(operandRefs.length!==2||pointLike.length!==2))throw diagnosticError('line requires exactly two point operands',child.loc,'geometry.operand');if(kind==='area'&&!operandRefs.length)throw diagnosticError('area requires geometry operands',child.loc,'geometry.operand');if(kind==='area'&&operandRefs.every(ref=>LKL_ENUMS.legacyGeometryPointTypes.includes(ref.type))&&operandRefs.length<3)throw diagnosticError('point-only area requires at least three points',child.loc,'geometry.operand');if(kind==='volume'&&!operandRefs.length)throw diagnosticError('volume requires geometry operands',child.loc,'geometry.operand');if(kind==='volume'&&operandRefs.every(ref=>LKL_ENUMS.legacyGeometryPointTypes.includes(ref.type))&&operandRefs.length<4)throw diagnosticError('point-only volume requires at least four points',child.loc,'geometry.operand');for(const ref of operandRefs){if(!LKL_ENUMS.geometryOperandTypes.includes(ref.type))throw diagnosticError(`Unsupported geometry operand reference ${ref.type}`,child.loc,'geometry.operand');if(ref.type==='slot'&&!slotIds.has(ref.id))throw diagnosticError(`Unknown geometry slot ${ref.id}`,child.loc,'geometry.operand');if(ref.type==='motion'&&!motionIds.has(ref.id))throw diagnosticError(`Unknown geometry motion ${ref.id}`,child.loc,'geometry.operand');if(ref.type==='geometry'&&(!geometryIds.has(ref.id)||ref.id===child.id))throw diagnosticError(`Unknown or recursive geometry reference ${ref.id}`,child.loc,'geometry.operand');if(ref.type==='plot'&&!plotIds.has(ref.id))throw diagnosticError(`Unknown geometry plot ${ref.id}`,child.loc,'geometry.operand')}return{id:child.id,kind,...(declaredOperands.length?{operandRefs}:{}),pointRefs:pointLike,visible:first(fields,'visible')!==false,style:{color:String(first(fields,'stroke')??'#355f78'),width:Number(first(fields,'width')??2),fill:String(first(fields,'fill')??'rgba(53,95,120,.14)')}}}
function groupStatements(items=[]){const map=new Map();for(const item of items){if(!map.has(item.key))map.set(item.key,[]);map.get(item.key).push(item)}return map}
function assertStructureSourceBlock(block){const root=LKL_STRUCTURE_SOURCE_SCHEMA.roots[block.kind],spec=root??LKL_STRUCTURE_SOURCE_SCHEMA.children[block.kind];if(!spec)throw diagnosticError(`Unsupported Structure Source declaration ${block.kind}`,block.loc,block.kind);const fields=new Set(spec.fields);for(const statement of block.statements)if(!fields.has(statement.key))throw diagnosticError(`Unsupported ${block.kind} field ${statement.key}`,statement.loc,statement.key);const children=new Set(root?.children??[]);for(const child of block.children){if(!children.has(child.kind))throw diagnosticError(`Unsupported ${block.kind} child declaration ${child.kind}`,child.loc,child.kind);assertStructureSourceBlock(child)}}
function first(group,key){return group.get(key)?.at(-1)?.values?.at(-1)}
function statementLoc(group,key){return group.get(key)?.at(-1)?.loc??{line:1,column:1}}
function parseJsonField(group,key,fallback){const statement=group.get(key)?.at(-1);if(!statement)return fallback;try{return JSON.parse(String(statement.values.at(-1)??'null'))}catch(error){throw diagnosticError(`${key}: ${error.message}`,statement.loc,key)}}
function diagnosticError(message,loc={line:1,column:1},field=null){if(typeof loc==='number')loc={line:loc,column:1};return Object.assign(new Error(message),{line:loc?.line??1,column:loc?.column??1,field})}
