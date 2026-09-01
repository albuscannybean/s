const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s_\-./]+/g,'');
const subsequence=(needle,haystack)=>{let index=0;for(const char of haystack)if(char===needle[index])index++;return index===needle.length};
const score=(query,item)=>{if(!query)return 1;const haystack=normalize(`${item.id} ${item.label} ${item.labelEn??''} ${(item.keywords??[]).join(' ')}`),needle=normalize(query);if(haystack.startsWith(needle))return 100-needle.length;if(haystack.includes(needle))return 80-needle.length;return subsequence(needle,haystack)?40-needle.length:0};

const command=(id,category,label,labelEn,keywords,run,available=()=>true,disabledReason='当前上下文不可用')=>({id,slash:`/${id.replaceAll('.',' ')}`,category,label,labelEn,keywords,run,available,disabledReason});

export function createCommandRegistry(app){
  const hasKnowledge=()=>!!app.knowledge,hasStructure=()=>!!app.instance,hasSlot=()=>[...app.selection].some(value=>value.startsWith('slot:')),coordinate=()=>app.template?.id==='builtin:coordinate-plane';
  return[
    command('knowledge.new','知识','新建知识','New knowledge',['create','新建'],()=>app.openQuickCreate(null,'blank')),
    command('knowledge.open','知识','打开知识库','Open knowledge library',['library','导航'],()=>{app.navigatorMode='outline';app.renderNavigator()}),
    command('knowledge.rename','知识','重命名当前知识','Rename knowledge',['title'],()=>app.renameKnowledge(app.currentKnowledgeId),hasKnowledge,'请先打开知识'),
    command('knowledge.delete','知识','删除当前知识','Delete knowledge',['remove'],()=>app.deleteKnowledge(app.currentKnowledgeId),hasKnowledge,'请先打开知识'),
    command('structure.insert','结构','插入结构','Insert structure',['library','add'],()=>app.openLibrary(),hasKnowledge,'请先打开知识'),
    command('structure.search','结构','结构查询','Structure query',['query','pattern'],()=>app.openSearchWorkbench()),
    command('structure.code','结构','打开结构代码','Open structure code',['lkl','source'],()=>app.openStructureSource(app.currentInstanceId),hasStructure,'当前没有结构'),
    command('structure.design','结构','打开结构设计','Open structure design',['style'],()=>app.openPanel('structure',app.currentInstanceId,'design'),hasStructure,'当前没有结构'),
    command('structure.rename','结构','重命名结构','Rename structure',['title'],()=>app.renameStructureInstance(app.currentInstanceId),hasStructure,'当前没有结构'),
    command('node.add','节点与关系','添加节点','Add node',['slot','point'],()=>app.executeCreateAction?.('add-node'),hasStructure,'当前没有结构'),
    command('node.open','节点与关系','打开选中节点','Open node',['slot'],()=>{const value=[...app.selection].find(item=>item.startsWith('slot:'));if(value)app.openContainer(value.slice(5))},hasSlot,'请先选中节点'),
    command('node.delete','节点与关系','删除选中节点','Delete node',['remove'],()=>app.deleteSelection(),hasSlot,'请先选中可删除节点'),
    command('relation.connect','节点与关系','建立关系','Connect relation',['edge','line'],()=>{const value=[...app.selection].find(item=>item.startsWith('slot:'));if(value)app.startTemporaryConnection(value.slice(5))},hasSlot,'请先选中起点节点'),
    command('relation.style','节点与关系','设计关系','Style relation',['edge'],()=>app.openPanel('structure',app.currentInstanceId,'design'),hasStructure,'当前没有结构'),
    command('relation.delete','节点与关系','删除选中关系','Delete relation',['edge','remove'],()=>app.deleteSelection(),()=>[...app.selection].some(value=>value.startsWith('edge:')),'请先选中关系'),
    command('lkl.manual','LKL','LKL 使用手册','LKL manual',['help','schema'],()=>app.openLklManual()),
    command('lkl.validate','LKL','验证 LKL','Validate LKL',['diagnostic'],()=>app.openImport()),
    command('lkl.import','LKL','导入知识包','Import package',['data'],()=>app.openImport()),
    command('lkl.export','LKL','导出 LKL 知识包','Export LKL package',['backup'],()=>app.exportAs('knowledge-package'),hasKnowledge,'请先打开知识'),
    command('lkl.format','LKL','格式化当前结构代码','Format LKL',['source'],()=>app.document.startsWith('source:')?app.formatStructureSource():app.openStructureSource(app.currentInstanceId),hasStructure,'当前没有结构'),
    command('view.fit','视图','适合窗口','Fit view',['zoom'],()=>app.fit(),hasStructure,'当前没有结构'),
    command('view.focus','视图','专注模式','Focus mode',['presentation'],()=>app.toggleFocus()),
    command('view.preview','视图','切换预览策略','Preview policy',['compact','detailed'],()=>app.cyclePreviewPolicy?.(),hasStructure,'当前没有结构'),
    command('geometry.point','几何','新建点','Create point',['vector space'],()=>{app.coordinateOperationMode='geometry';app.openPanel('structure',app.currentInstanceId,'plot')},coordinate,'当前结构不是向量空间'),
    command('geometry.vector','几何','新建向量','Create vector',['vector space'],()=>{app.coordinateOperationMode='geometry';app.openPanel('structure',app.currentInstanceId,'plot')},coordinate,'当前结构不是向量空间'),
    command('geometry.curve','几何','新建曲线','Create curve',['plot'],()=>{app.coordinateOperationMode='geometry';app.openPanel('structure',app.currentInstanceId,'plot')},coordinate,'当前结构不是向量空间'),
    command('geometry.surface','几何','新建曲面','Create surface',['plot 3d'],()=>{app.coordinateOperationMode='geometry';app.openPanel('structure',app.currentInstanceId,'plot')},coordinate,'当前结构不是向量空间'),
    command('geometry.orbit','几何','自由环绕视角','Orbit camera',['3d'],()=>app.setCoordinateProjection?.('free'),coordinate,'当前结构不是向量空间'),
    command('data.import','数据','导入知识包','Import package',['file'],()=>app.openImport()),
    command('data.export','数据','导出 / 备份','Export / backup',['file'],()=>app.openExport?.()??document.querySelector('#exportDialog')?.showModal(),hasKnowledge,'请先打开知识'),
    command('settings.theme','设置','全局设计','Global design',['theme','font'],()=>app.openGlobalSettings()),
    command('settings.language','设置','界面语言','Interface language',['中文','english'],()=>app.openGlobalSettings('language')),
    command('settings.motion','设置','动画与交互','Motion and interaction',['reduce motion'],()=>app.openGlobalSettings('motion'))
  ];
}

export function searchCommandRegistry(items,query=''){
  return items.map(item=>({...item,enabled:item.available(),score:score(query,item)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.category.localeCompare(b.category)||a.label.localeCompare(b.label));
}

export function groupCommands(items){const groups=new Map();for(const item of items){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item)}return groups}
