// Routing is a user/model choice. Labels never rewrite a relation's geometry.
const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
export function segmentIntersectsNode(a,b,n,padding=6){
 const box={left:n.x-padding,right:n.x+n.width+padding,top:n.y-padding,bottom:n.y+n.height+padding};
 let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x-box.left],[dx,box.right-a.x],[-dy,a.y-box.top],[dy,box.bottom-a.y]]){
  if(Math.abs(p)<1e-10){if(q<0)return false;continue}
  const r=q/p;if(p<0)low=Math.max(low,r);else high=Math.min(high,r);if(low>high)return false;
 }
 return true;
}
const pathText=points=>'M '+points.map((p,i)=>(i?'L ':'')+p.x+' '+p.y).join(' ');
function port(node,vector,normal,offset){
 const c=center(node),origin={x:c.x+normal.x*offset,y:c.y+normal.y*offset};
 const inside=p=>{
  const x=Math.abs(p.x-c.x),y=Math.abs(p.y-c.y),w=node.width/2,h=node.height/2;
  if(node.shape==='circle')return(x/w)**2+(y/h)**2<=1;
  if(x>w||y>h)return false;
  const radius=['roundedRect','pill'].includes(node.shape)?Math.max(0,Math.min(node.radius??11,w,h)):0;
  return!radius||x<=w-radius||y<=h-radius||(x-w+radius)**2+(y-h+radius)**2<=radius**2;
 };
 let low=0,high=Math.hypot(node.width,node.height)*2;
 for(let step=0;step<40;step++){const t=(low+high)/2,p={x:origin.x+vector.x*t,y:origin.y+vector.y*t};if(inside(p))low=t;else high=t;}
 return{x:origin.x+vector.x*low,y:origin.y+vector.y*low};
}
export function routeIndependentRelations(edges,nodes,{anchor}={}){
 const byId=new Map(nodes.map(n=>[n.id,n])),families=new Map();
 for(const edge of edges){const key=JSON.stringify([edge.sourceSlotId,edge.targetSlotId].sort());if(!families.has(key))families.set(key,[]);families.get(key).push(edge);}
 for(const group of families.values())group.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 return edges.map(edge=>{
  const source=byId.get(edge.sourceSlotId),target=byId.get(edge.targetSlotId);if(!source||!target)return edge;
  const group=families.get(JSON.stringify([edge.sourceSlotId,edge.targetSlotId].sort())),index=group.indexOf(edge);
  if(source===target){
   if(group.length===1)return edge;
   const lift=96+index*64,start={x:source.x+source.width*.22,y:source.y},end={x:source.x+source.width*.78,y:source.y},c1={x:source.x-48-index*16,y:source.y-lift},c2={x:source.x+source.width+48+index*16,y:source.y-lift};
   return{...edge,selfLoop:true,start,end,points:[start,c1,c2,end],path:'M '+start.x+' '+start.y+' C '+c1.x+' '+c1.y+', '+c2.x+' '+c2.y+', '+end.x+' '+end.y,lane:index};
  }
  if(group.length===1)return edge;
  const a=center(source),b=center(target),dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||1,unit={x:dx/distance,y:dy/distance},sign=String(source.id)<String(target.id)?1:-1,normal={x:-unit.y*sign,y:unit.x*sign};
  const room=Math.min(source.width,source.height,target.width,target.height)*.8,spacing=Math.min(38,room/Math.max(1,group.length-1)),lane=(index-(group.length-1)/2)*spacing;
  const start=port(source,unit,normal,lane),end=port(target,{x:-unit.x,y:-unit.y},normal,lane);
  if(edge.routing==='radial-arc'&&edge.arc){
   const radius=Math.max(Math.hypot(edge.end.x-edge.start.x,edge.end.y-edge.start.y)/2+.01,edge.arc.radius+index*28),arc={...edge.arc,radius};
   return{...edge,arc,lane:index,path:'M '+edge.start.x+' '+edge.start.y+' A '+radius+' '+radius+' 0 '+(arc.largeArc??0)+' '+arc.sweep+' '+edge.end.x+' '+edge.end.y};
  }
  if(edge.routing==='orthogonal'){
   const horizontal=Math.abs(dx)>=Math.abs(dy),mid=horizontal?(start.x+end.x)/2+lane:(start.y+end.y)/2+lane,points=horizontal?[start,{x:mid,y:start.y},{x:mid,y:end.y},end]:[start,{x:start.x,y:mid},{x:end.x,y:mid},end];
   return{...edge,start,end,points,path:pathText(points),lane:index};
  }
  if(edge.routing==='bezier'){
   const shift=lane*4/3,original=edge.points,c1={x:original[1].x+normal.x*shift,y:original[1].y+normal.y*shift},c2={x:original[2].x+normal.x*shift,y:original[2].y+normal.y*shift},s=anchor(source,c1),e=anchor(target,c2),points=[s,c1,c2,e];
   return{...edge,start:s,end:e,points,path:'M '+s.x+' '+s.y+' C '+c1.x+' '+c1.y+', '+c2.x+' '+c2.y+', '+e.x+' '+e.y,lane:index};
  }
  return{...edge,start,end,points:[start,end],path:pathText([start,end]),lane:index};
 });
}
