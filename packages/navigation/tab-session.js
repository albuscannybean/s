const copy=value=>value==null?value:structuredClone(value);

export function createTabSession({key,knowledgeId=null,id,location=null}={}){
  return{key,knowledgeId,id,history:location?[copy(location)]:[],historyIndex:location?0:-1,location:copy(location)};
}

export function pushTabLocation(tab,location){
  if(!tab||!location)return null;const next=copy(location),current=tab.history?.[tab.historyIndex];if(current&&JSON.stringify(current)===JSON.stringify(next)){tab.location=next;return next}tab.history=(tab.history??[]).slice(0,(tab.historyIndex??-1)+1);tab.history.push(next);tab.historyIndex=tab.history.length-1;tab.location=next;return next;
}

export function replaceTabLocation(tab,location){if(!tab||!location)return null;const next=copy(location);tab.history??=[];if((tab.historyIndex??-1)<0){tab.history.push(next);tab.historyIndex=0}else tab.history[tab.historyIndex]=next;tab.location=next;return next}

export function moveTabHistory(tab,direction){if(!tab)return null;const index=(tab.historyIndex??-1)+(direction<0?-1:1);if(index<0||index>=(tab.history?.length??0))return null;tab.historyIndex=index;tab.location=copy(tab.history[index]);return copy(tab.location)}

export function tabCanMove(tab,direction){const index=tab?.historyIndex??-1;return direction<0?index>0:index>=0&&index<(tab?.history?.length??0)-1}

export function currentTabLocation(tab){return copy(tab?.history?.[tab.historyIndex]??tab?.location??null)}
