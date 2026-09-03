const point=value=>({x:Number(value?.x??0),y:Number(value?.y??0),z:Number(value?.z??0)});
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;

export function polygonArea2d(points=[]){
  if(points.length<3)return 0;let twice=0;
  for(let index=0;index<points.length;index++){const a=point(points[index]),b=point(points[(index+1)%points.length]);twice+=a.x*b.y-b.x*a.y}
  return Math.abs(twice)/2;
}

export function triangleArea3d(points=[]){
  if(points.length<3)return 0;const origin=point(points[0]);let area=0;
  for(let index=1;index<points.length-1;index++){const normal=cross(subtract(point(points[index]),origin),subtract(point(points[index+1]),origin));area+=Math.hypot(normal.x,normal.y,normal.z)/2}
  return area;
}

export function tetrahedronVolume(points=[]){
  if(points.length<4)return 0;const a=point(points[0]),ab=subtract(point(points[1]),a),ac=subtract(point(points[2]),a),ad=subtract(point(points[3]),a);
  return Math.abs(dot(ab,cross(ac,ad)))/6;
}

export function meshSurfaceArea(triangles=[]){return triangles.reduce((sum,triangle)=>sum+triangleArea3d(triangle),0)}

export function meshVolume(triangles=[]){
  let signed=0;for(const triangle of triangles){const[a,b,c]=triangle.map(point);signed+=dot(a,cross(b,c))/6}return Math.abs(signed);
}

export function measureGeometry(kind,points=[],dimension='2d'){
  if(kind==='line'&&points.length>=2){const a=point(points[0]),b=point(points[1]);return Math.hypot(b.x-a.x,b.y-a.y,dimension==='3d'?b.z-a.z:0)}
  if(kind==='area')return dimension==='3d'?triangleArea3d(points):polygonArea2d(points);
  if(kind==='volume')return dimension==='3d'?tetrahedronVolume(points):null;
  return null;
}
