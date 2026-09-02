const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const SEMANTIC_ZOOM_LEVELS=Object.freeze({overview:.35,compact:.65,detail:1.4});

export function semanticZoomDensity(zoom=1){return zoom<SEMANTIC_ZOOM_LEVELS.overview?'overview':zoom<SEMANTIC_ZOOM_LEVELS.compact?'compact':zoom>SEMANTIC_ZOOM_LEVELS.detail?'detail':'normal'}

function estimatedLines(text,width,padding){
  const available=Math.max(40,width-padding*2),units=Array.from(String(text??'')).reduce((sum,char)=>sum+(/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(char)?1.7:1),0),perLine=Math.max(8,Math.floor(available/7.2));return Math.max(1,Math.ceil(units/perLine));
}

export function measureNodePresentation(slot={},options={}){
  const design=options.design??{},minimum=options.minimum??{width:188,height:92},autoSize=design.autoSize!==false,padding=clamp(Number(design.padding??12),6,32),maxTitleLines=clamp(Number(design.maxTitleLines??3),1,5),minWidth=Math.max(Number(design.minWidth??minimum.width),40),maxWidth=Math.max(minWidth,Number(design.maxWidth??280)),minHeight=Math.max(Number(design.minHeight??minimum.height),36),title=slot.displayLabel??slot.containerState?.presentation?.primaryTitle??slot.label??slot.id??'',secondary=slot.containerState?.secondaryTitle??slot.containerState?.presentation?.secondaryTitle??'',summary=slot.containerState?.summary??'',badges=slot.containerState?.badges??[],preferred=autoSize?clamp(Math.ceil(Math.max(0,...String(title).split(/\s+/).map(part=>part.length))*7.2+padding*2),minWidth,maxWidth):minWidth,lines=Math.min(maxTitleLines,estimatedLines(title,preferred,padding)),contentLines=(secondary?1:0)+(summary?1:0)+(badges.length?1:0),chromeHeight=34,height=Math.max(minHeight,padding*2+chromeHeight+lines*18+contentLines*14);
  return{width:preferred,height,lines,padding,title,autoSize};
}

export function measureDefinitionNodes(definition,instance={},minimum={width:188,height:92}){
  const configured=instance.designStyles?.nodeDefault??{},specialized=String(definition.id??'').includes('boolean-algebra'),design={...configured,autoSize:configured.autoSize??!specialized};return new Map((definition.slots??[]).map(slot=>[slot.id,measureNodePresentation(slot,{design,minimum})]));
}
