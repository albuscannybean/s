// Independent routes are derived from edge identity; shared endpoints never merge relations.
const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
export function segmentIntersectsNode(a,b,n,padding=6){
 const box={left:n.x-padding,right:n.x+n.width+padding,top:n.y-padding,bottom:n.y+n.height+padding};
 let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x-box.left],[dx,box.right-a.x],[-dy,a.y-box.top],[dy,box.bottom-a.y]]){
  if(Math.abs(p)<1e-10){if(q<0)return false;continue}
  const r=q/p;if(p<0)low=Math.max(low,r);else high=Math.min(high,r);if(low>high)return false;
 }
 return true;
}
const boxHit=(b,n)=>b.x<n.x+n.width+8&&b.x+b.width>n.x-8&&b.y<n.y+n.height+8&&b.y+b.height>n.y-8;
const pathText=points=>'M '+points.map((p,i)=>(i?'L ':'')+p.x+' '+p.y).join(' ');
export function routeIndependentRelations(edges,nodes,{route,anchor,labelWidth}){
 const byId=new Map(nodes.map(n=>[n.id,n])),families=new Map();
 for(const edge of edges){const key=JSON.stringify([edge.sourceSlotId,edge.targetSlotId].sort());if(!families.has(key))families.set(key,[]);families.get(key).push(edge)}
 for(const group of families.values())group.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 return edges.map(edge=>{
  const source=byId.get(edge.sourceSlotId),target=byId.get(edge.targetSlotId);if(!source||!target)return edge;
  const group=families.get(JSON.stringify([edge.sourceSlotId,edge.targetSlotId].sort())),index=group.indexOf(edge),lane=(index-(group.length-1)/2)*64,sourceCenter=center(source),targetCenter=center(target);
  if(source===target){
   const lift=96+index*64,start={x:source.x+source.width*.22,y:source.y-4},end={x:source.x+source.width*.78,y:source.y-4},c1={x:source.x-48-index*16,y:source.y-lift},c2={x:source.x+source.width+48+index*16,y:source.y-lift};
   return {...edge,routing:'bezier',selfLoop:true,start,end,points:[start,c1,c2,end],path:'M '+start.x+' '+start.y+' C '+c1.x+' '+c1.y+', '+c2.x+' '+c2.y+', '+end.x+' '+end.y};
  }
  const label=edge.displayLabel??edge.label??'',width=label?labelWidth(label):0;
  const midpoint={x:(edge.start.x+edge.end.x)/2,y:(edge.start.y+edge.end.y)/2};
  const labelBox={x:midpoint.x-width/2,y:midpoint.y-18,width,height:36};
  const obstacles=nodes.filter(n=>n.id!==source.id&&n.id!==target.id);
  const directBlocked=obstacles.some(n=>segmentIntersectsNode(edge.start,edge.end,n));
  const labelBlocked=width>0&&nodes.some(n=>boxHit(labelBox,n));
  if(group.length===1&&!directBlocked&&!labelBlocked)return edge;
  const dx=targetCenter.x-sourceCenter.x,dy=targetCenter.y-sourceCenter.y,horizontal=Math.abs(dx)>=Math.abs(dy);
  // Canonical endpoint order keeps reverse relations in different lanes.
  const sign=String(source.id)<String(target.id)?1:-1,distance=Math.hypot(dx,dy)||1,normal={x:-dy/distance*sign,y:dx/distance*sign};
  if(group.length>1&&!directBlocked&&!labelBlocked){
   const shift=lane*4/3,c1={x:sourceCenter.x+dx/3+normal.x*shift,y:sourceCenter.y+dy/3+normal.y*shift},c2={x:sourceCenter.x+dx*2/3+normal.x*shift,y:sourceCenter.y+dy*2/3+normal.y*shift},start=anchor(source,c1),end=anchor(target,c2);
   const points=[start,c1,c2,end];
   const sampled=Array.from({length:25},(_,i)=>{const t=i/24,o=1-t;return{x:o**3*start.x+3*o*o*t*c1.x+3*o*t*t*c2.x+t**3*end.x,y:o**3*start.y+3*o*o*t*c1.y+3*o*t*t*c2.y+t**3*end.y}});
   if(!sampled.slice(1).some((p,i)=>obstacles.some(n=>segmentIntersectsNode(sampled[i],p,n))))return{...edge,routing:'bezier',start,end,points,path:'M '+start.x+' '+start.y+' C '+c1.x+' '+c1.y+', '+c2.x+' '+c2.y+', '+end.x+' '+end.y,lane:index};
  }
  const candidates=[],margin=38+Math.abs(lane),relevant=nodes.filter(n=>n===source||n===target||segmentIntersectsNode(sourceCenter,targetCenter,n,width/2+12));
  const top=Math.min(...relevant.map(n=>n.y))-margin,bottom=Math.max(...relevant.map(n=>n.y+n.height))+margin,left=Math.min(...relevant.map(n=>n.x))-Math.max(margin,width/2+24),right=Math.max(...relevant.map(n=>n.x+n.width))+Math.max(margin,width/2+24);
  const make=(axis,value)=>{
   const p=axis==='y'?{x:sourceCenter.x,y:value}:{x:value,y:sourceCenter.y},q=axis==='y'?{x:targetCenter.x,y:value}:{x:value,y:targetCenter.y},start=anchor(source,p),end=anchor(target,q),points=[start,p,q,end];
   const hits=points.slice(1).reduce((sum,b,i)=>sum+obstacles.filter(n=>segmentIntersectsNode(points[i],b,n)).length,0),middle={x:(p.x+q.x)/2,y:(p.y+q.y)/2},labelHits=width?nodes.filter(n=>boxHit({x:middle.x-width/2,y:middle.y-18,width,height:36},n)).length:0;
   candidates.push({points,start,end,cost:hits*1e7+labelHits*1e7+length(points)+(horizontal===(axis==='y')?0:20)});
  };
  make('y',top-lane);make('y',bottom-lane);make('x',left+lane);make('x',right+lane);
  // Outer lanes provide a deterministic escape when a local route is obstructed.
  make('y',Math.min(...nodes.map(n=>n.y))-margin-48-index*20);make('y',Math.max(...nodes.map(n=>n.y+n.height))+margin+48+index*20);
  candidates.sort((a,b)=>a.cost-b.cost);const best=candidates[0];
  return{...edge,routing:'orthogonal',...best,path:pathText(best.points),lane:index};
 });
}

