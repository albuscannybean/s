const prefersReducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
const mix=(a,b,t)=>a+(b-a)*t;

export function interpolateGeometry(previous,next,t){
  const oldNodes=new Map((previous?.nodes??[]).map(node=>[node.id,node]));
  return{...next,nodes:next.nodes.map(node=>{const from=oldNodes.get(node.id)??node;return{...node,x:mix(from.x,node.x,t),y:mix(from.y,node.y,t),width:mix(from.width,node.width,t),height:mix(from.height,node.height,t)}})};
}

export class SceneTransition{
  constructor({duration=190,onFrame=()=>{},reducedMotion=prefersReducedMotion}={}){this.duration=duration;this.onFrame=onFrame;this.reducedMotion=reducedMotion;this.frame=0}
  cancel(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0}
  run(previous,next){this.cancel();if(!previous||this.reducedMotion()){this.onFrame(next,1);return Promise.resolve(next)}
    const start=performance.now();return new Promise(resolve=>{const tick=now=>{const raw=Math.min(1,(now-start)/this.duration),t=1-Math.pow(1-raw,3);this.onFrame(interpolateGeometry(previous,next,t),t);if(raw<1)this.frame=requestAnimationFrame(tick);else{this.frame=0;resolve(next)}};this.frame=requestAnimationFrame(tick)})}
}

export class RenderScheduler{
  constructor(callback){this.callback=callback;this.frame=0;this.reasons=new Set()}
  request(reason='state'){this.reasons.add(reason);if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;const reasons=[...this.reasons];this.reasons.clear();this.callback(reasons)})}
  cancel(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.reasons.clear()}
}
