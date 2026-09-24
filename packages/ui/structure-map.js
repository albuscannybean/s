import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildSceneGeometry} from '../geometry/scene-geometry.js';
import {mapArrowEnds,nextMapNodes} from '../navigation/structure-map.js';

const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node};
const svg=(tag,attrs={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node};

export function installStructureMap(Controller){
  Controller.prototype.structureMapContexts=function(){
    if(['welcome','global-settings','search-workbench','lkl-manual'].includes(this.document)||this.document.startsWith('new-tab'))return [];
    const slots=[...(this.path??[])].reverse().filter(p=>p.kind==='slot'),ids=slots.map(p=>p.instanceId);
    if(this.currentInstanceId)this.document.startsWith('structure:')?ids.unshift(this.currentInstanceId):ids.push(this.currentInstanceId);
    if(this.navigatorDetailTarget?.instanceId&&this.document.startsWith('navigator-object:'))ids.unshift(this.navigatorDetailTarget.instanceId);
    for(const p of [...(this.path??[])].reverse())if(p.kind==='structure')ids.push(p.id);
    return [...new Set(ids)].flatMap(id=>{
      const instance=this.state.structureInstances.find(i=>i.id===id),template=this.state.structureTemplates.find(t=>t.id===instance?.templateId);if(!instance||!template)return [];
      const definition=materializeInstanceDefinition(template,instance),currentId=slots.find(p=>p.instanceId===id)?.id??(id===this.currentInstanceId?this.selectedSlotId():null);
      return [{instance,template,definition,currentId:definition.slots.some(s=>s.id===currentId)?currentId:null}];
    });
  };
  Controller.prototype.renderStructureMapButton=function(){
    let button=document.getElementById('structureMapButton');
    if(!button){button=element('button','','地图');button.id='structureMapButton';button.type='button';button.setAttribute('aria-haspopup','dialog');button.onclick=()=>this.openStructureMap();document.querySelector('.canvas-actions').prepend(button)}
    button.textContent=this.preferences.language==='en'?'Map':'地图';button.hidden=!this.structureMapContexts().length;
  };
  Controller.prototype.openStructureMap=function(instanceId){
    const contexts=this.structureMapContexts(),context=contexts.find(c=>c.instance.id===instanceId)??contexts[0];if(!context)return;
    let dialog=document.getElementById('structureMapDialog');
    if(!dialog){dialog=element('dialog','structure-map-dialog');dialog.id='structureMapDialog';dialog.setAttribute('aria-labelledby','structureMapTitle');dialog.addEventListener('keydown',event=>event.stopPropagation());document.body.append(dialog)}
    const en=this.preferences.language==='en',say=(zh,english)=>en?english:zh;
    const {instance,definition,currentId}=context,next=nextMapNodes(definition,currentId),nextIds=new Set(next.map(n=>n.id));
    dialog.replaceChildren();
    const header=element('header','structure-map-header'),title=element('h2','',say('地图','Map')),close=element('button','',say('关闭','Close'));title.id='structureMapTitle';close.type='button';close.onclick=()=>dialog.close();header.append(title,close);dialog.append(header);
    const controls=element('div','structure-map-controls'),label=element('label','',say('当前结构','Structure')),select=element('select');
    for(const c of contexts){const option=element('option','',this.structureDisplayTitle(c.instance,c.template));option.value=c.instance.id;select.append(option)}
    select.value=instance.id;select.onchange=()=>this.openStructureMap(select.value);label.append(select);controls.append(label);
    const jump=element('label','',say('跳转到任意节点','Jump to a node')),dest=element('select'),placeholder=element('option','',say('选择节点…','Choose a node…'));placeholder.value='';placeholder.disabled=true;dest.append(placeholder);
    const titleFor=id=>{const slot=definition.slots.find(s=>s.id===id);return slot?this.effectiveSlotTitle(instance,slot):id};
    const navigate=id=>{dialog.close();this.openInstance(instance.id,false);this.openSlot(id)};
    for(const slot of definition.slots){const option=element('option','',titleFor(slot.id));option.value=slot.id;dest.append(option)}
    dest.value='';dest.onchange=()=>navigate(dest.value);jump.append(dest);controls.append(jump);dialog.append(controls);
    const status=element('p','structure-map-status',currentId?say('当前位置：','Current: ')+titleFor(currentId):say('尚未进入节点；选择地图中的任意节点开始。','Choose any node to begin.'));status.setAttribute('aria-live','polite');dialog.append(status);
    const choices=element('div','structure-map-next');choices.append(element('strong','',say('下一步','Next')));
    if(!next.length)choices.append(element('span','',currentId?say('没有沿箭头可达的下一节点。','No outgoing arrows from this node.'):say('进入节点后，按出向箭头显示选项。','Outgoing choices appear after entering a node.')));
    for(const item of next){const button=element('button','map-next-choice',titleFor(item.id));button.type='button';button.dataset.nextSlotId=item.id;button.title=item.edges.map(e=>e.displayLabel??e.label??e.relationType).filter(Boolean).join(' · ');button.onclick=()=>navigate(item.id);choices.append(button)}
    dialog.append(choices);
    const figure=element('div','structure-map-figure'),canvas=svg('svg',{viewBox:'0 0 860 460',role:'group','aria-label':say('结构节点与关系；亮框表示下一步','Nodes and relations; highlighted nodes are next choices')});
    const defs=svg('defs'),marker=svg('marker',{id:'structure-map-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M0 0L10 5L0 10Z'}));defs.append(marker);canvas.append(defs);
    const scene=buildSceneGeometry(definition,instance),nodes=scene.nodes??[],positions=new Map();
    const xs=nodes.map(n=>n.x+n.width/2),ys=nodes.map(n=>n.y+n.height/2),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    nodes.forEach((node,index)=>positions.set(node.id,{x:maxX===minX?430:60+(xs[index]-minX)/(maxX-minX)*740,y:maxY===minY?230:42+(ys[index]-minY)/(maxY-minY)*376}));
    for(const edge of definition.edges??[]){const a=positions.get(edge.sourceSlotId),b=positions.get(edge.targetSlotId);if(!a||!b)continue;const vx=b.x-a.x,vy=b.y-a.y,ratio=Math.min(vx?56/Math.abs(vx):Infinity,vy?22/Math.abs(vy):Infinity),dx=a===b?0:vx*ratio,dy=a===b?0:vy*ratio,{start,end}=mapArrowEnds(edge);
      const path=svg('path',{d:a===b?`M ${a.x-10} ${a.y-17} C ${a.x-55} ${a.y-65},${a.x+55} ${a.y-65},${a.x+10} ${a.y-17}`:`M ${a.x+dx} ${a.y+dy} L ${b.x-dx} ${b.y-dy}`,class:'map-edge'});
      if(end)path.setAttribute('marker-end','url(#structure-map-arrow)');if(start)path.setAttribute('marker-start','url(#structure-map-arrow)');canvas.append(path);
    }
    for(const slot of definition.slots){const p=positions.get(slot.id);if(!p)continue;const current=slot.id===currentId,isNext=nextIds.has(slot.id),name=titleFor(slot.id),group=svg('g',{class:`map-node${current?' is-current':''}${isNext?' is-next':''}`,transform:`translate(${p.x} ${p.y})`,tabindex:'0',role:'button','data-map-slot-id':slot.id,'aria-label':name+(current?say(' · 当前',' · Current'):'')+(isNext?say(' · 下一步',' · Next'):'')});if(current)group.setAttribute('aria-current','location');
      const tip=svg('title');tip.textContent=name;const text=svg('text',{'text-anchor':'middle',y:5});text.textContent=name.length>7?name.slice(0,6)+'…':name;group.append(tip,svg('rect',{x:-52,y:-18,width:104,height:36,rx:4}),text);group.onclick=()=>navigate(slot.id);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate(slot.id)}};canvas.append(group);
    }
    figure.append(canvas);dialog.append(figure,element('p','structure-map-legend',say('实心标记：当前节点　亮框：沿箭头的下一步　点击任意节点可跳转','Filled: current · Highlighted: next · Select any node to jump')));
    if(!dialog.open)dialog.showModal();
  };
}
