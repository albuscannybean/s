export function knowledgeSegment(knowledge){return{kind:'knowledge',id:knowledge.id,label:knowledge.title}}
export function slotSegment(instanceId,slot){return{kind:'slot',id:slot.id,instanceId,label:slot.displayLabel??slot.label,role:slot.role}}
export function structureSegment(instance,template){return{kind:'structure',id:instance.id,label:instance.displayTitle??instance.objectContent?.title??template.name,templateId:template.id}}
export function appendPath(path,...segments){const next=[...(path??[])];for(const segment of segments){if(!segment)continue;const index=next.findIndex(item=>item.kind===segment.kind&&item.id===segment.id&&item.instanceId===segment.instanceId);if(index>=0)next[index]={...next[index],...segment};else next.push({...segment})}return next}
export function truncatePath(path,index){return(path??[]).slice(0,index+1).map(item=>({...item}))}
export function pathLabel(path){return(path??[]).map(segment=>segment.label).join(' › ')}
export function validateNavigatorPath(path,state){const errors=[];for(const segment of path??[]){if(segment.kind==='knowledge'&&!state.knowledge?.some(item=>item.id===segment.id))errors.push(`Missing Knowledge ${segment.id}`);if(segment.kind==='structure'&&!state.structureInstances?.some(item=>item.id===segment.id))errors.push(`Missing Structure ${segment.id}`);if(segment.kind==='slot'&&!segment.instanceId)errors.push(`Slot ${segment.id} has no instance context`)}return{valid:!errors.length,errors}}

export class NavigationHistory{
  constructor(initial=null){this.entries=initial?[structuredClone(initial)]:[];this.index=this.entries.length-1}
  push(location){const current=this.entries[this.index];if(current&&JSON.stringify(current)===JSON.stringify(location))return current;this.entries.splice(this.index+1);this.entries.push(structuredClone(location));this.index=this.entries.length-1;return location}
  back(){if(this.index<=0)return null;return structuredClone(this.entries[--this.index])}
  forward(){if(this.index>=this.entries.length-1)return null;return structuredClone(this.entries[++this.index])}
  get canBack(){return this.index>0}get canForward(){return this.index>=0&&this.index<this.entries.length-1}
}
