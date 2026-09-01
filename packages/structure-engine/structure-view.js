const clone=value=>structuredClone(value);
const ZERO_ANCHORS=Object.freeze({top:-90,right:0,bottom:90,left:180});

export const DEFAULT_STRUCTURE_VIEW=Object.freeze({
  layout:null,displayMode:'structure',arrangement:null,orientation:{zeroAnchor:'top',direction:'clockwise',rotationAngle:0},camera:{projection:'free',yaw:42,pitch:28},manualPositions:{},zoomPolicy:'semantic',semanticZoom:true,previewPolicy:'compact',defaultFocus:null,savedZoom:null
});

export const ARRANGEMENT_OPTIONS=Object.freeze(['horizontal-forward','horizontal-reverse','vertical-forward','vertical-reverse']);
const normalizeArrangement=value=>value==='horizontal'?'horizontal-forward':value==='vertical'?'vertical-forward':ARRANGEMENT_OPTIONS.includes(value)?value:null;

export function normalizeStructureView(value={}){
  const orientation=value.orientation??{},zeroAnchor=['top','right','bottom','left','custom'].includes(orientation.zeroAnchor)?orientation.zeroAnchor:'top',direction=['clockwise','counterclockwise'].includes(orientation.direction)?orientation.direction:'clockwise';
  const arrangement=normalizeArrangement(value.arrangement);
  const camera=value.camera??{},projection=['xOy','yOz','xOz','free'].includes(camera.projection)?camera.projection:'free';
  const previewPolicy=['off','compact','detailed'].includes(value.previewPolicy)?value.previewPolicy:'compact';return{...clone(DEFAULT_STRUCTURE_VIEW),...clone(value),displayMode:value.displayMode==='chart'?'chart':'structure',arrangement,previewPolicy,orientation:{zeroAnchor,direction,rotationAngle:Number(orientation.rotationAngle??0)||0},camera:{projection,yaw:Number(camera.yaw??42)||0,pitch:Math.max(-85,Math.min(85,Number(camera.pitch??28)||0))},manualPositions:clone(value.manualPositions??{})};
}

export function structureViewCapability(template={}){
  if(template.viewCapability){const capability=clone(template.viewCapability);if(capability.mode==='arrange'){capability.defaultArrangement=normalizeArrangement(capability.defaultArrangement)??'horizontal-forward';capability.options=[...ARRANGEMENT_OPTIONS]}return capability}
  const layout=template.layout?.type??'grid';
  if(['radial'].includes(layout))return{mode:'rotate',label:'可旋转',defaultArrangement:null};
  if(['lmn-semantic','columns','timeline','tree','hasse','layered'].includes(layout))return{mode:'arrange',label:'可排列',defaultArrangement:layout==='hasse'?'vertical-reverse':['tree','layered'].includes(layout)?'vertical-forward':'horizontal-forward',options:[...ARRANGEMENT_OPTIONS]};
  return{mode:'fixed',label:'固定视角',defaultArrangement:null};
}

export function setStructureArrangement(instance,template,arrangement){const capability=structureViewCapability(template),view=ensureStructureView(instance);if(capability.mode!=='arrange')return view;const normalized=normalizeArrangement(arrangement);view.arrangement=capability.options.includes(normalized)?normalized:capability.defaultArrangement;return view}

export function ensureStructureView(instance){const existing=instance.structureView;if(existing){const normalized=normalizeStructureView(existing);for(const key of Object.keys(existing))delete existing[key];Object.assign(existing,normalized);return existing}instance.structureView=normalizeStructureView(instance.view??{});return instance.structureView}

export function modularAngle(index,count,view={}){
  const normalized=normalizeStructureView(view),orientation=normalized.orientation,base=orientation.zeroAnchor==='custom'?0:ZERO_ANCHORS[orientation.zeroAnchor],direction=orientation.direction==='counterclockwise'?-1:1;
  return base+direction*(Number(index)||0)*360/Math.max(1,Number(count)||1)+orientation.rotationAngle;
}

export function rotateStructureView(instance,deltaDegrees){const view=ensureStructureView(instance);view.orientation.rotationAngle=((view.orientation.rotationAngle+Number(deltaDegrees||0))%360+360)%360;return view}
export function resetStructureOrientation(instance){const view=ensureStructureView(instance);view.orientation={zeroAnchor:'top',direction:'clockwise',rotationAngle:0};return view}

export function setStructureDisplayMode(instance,mode){const view=ensureStructureView(instance);view.displayMode=mode==='chart'?'chart':'structure';return view}

export function structureViewSemanticSnapshot(instance){const view=ensureStructureView(instance);return clone({layout:view.layout,displayMode:view.displayMode,arrangement:view.arrangement,orientation:view.orientation,camera:view.camera,previewPolicy:view.previewPolicy,manualPositions:view.manualPositions,zoomPolicy:view.zoomPolicy,semanticZoom:view.semanticZoom,defaultFocus:view.defaultFocus,savedZoom:view.savedZoom})}
