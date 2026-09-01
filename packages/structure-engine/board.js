const uid=()=>globalThis.crypto?.randomUUID?.()??`board-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();

export function createBoard(ownerKnowledgeId,title='组合页面'){
  const timestamp=now();return{id:uid(),stableId:null,ownerKnowledgeId,title,description:'',frames:[],viewport:{zoom:1,panX:0,panY:0},createdAt:timestamp,updatedAt:timestamp};
}

export function createBoardFrame(instanceId,options={}){
  return{id:options.id??uid(),instanceId,x:Number(options.x??80),y:Number(options.y??80),width:Math.max(280,Number(options.width??520)),height:Math.max(220,Number(options.height??360)),zIndex:Number(options.zIndex??1),order:Number(options.order??0),previewPolicy:options.previewPolicy??'detailed'};
}

export function normalizeBoard(board={}){
  board.frames=(board.frames??[]).map((frame,index)=>createBoardFrame(frame.instanceId,{...frame,order:frame.order??index,zIndex:frame.zIndex??index+1}));board.viewport={zoom:1,panX:0,panY:0,...(board.viewport??{})};board.title=String(board.title??'组合页面');return board;
}

export function ensureBoardState(state){state.boards??=[];for(const board of state.boards)normalizeBoard(board);return state.boards}

export function addBoardFrame(board,instanceId,options={}){normalizeBoard(board);const frame=createBoardFrame(instanceId,{order:board.frames.length,zIndex:Math.max(0,...board.frames.map(item=>item.zIndex))+1,...options});board.frames.push(frame);board.updatedAt=now();return frame}
export function updateBoardFrame(board,frameId,patch={}){const frame=normalizeBoard(board).frames.find(item=>item.id===frameId);if(!frame)throw new Error(`Unknown frame ${frameId}`);Object.assign(frame,patch);frame.width=Math.max(280,Number(frame.width));frame.height=Math.max(220,Number(frame.height));board.updatedAt=now();return frame}
export function removeBoardFrame(board,frameId){const before=normalizeBoard(board).frames.length;board.frames=board.frames.filter(item=>item.id!==frameId);board.updatedAt=now();return board.frames.length<before}

export function validateBoards(state){const instances=new Set((state.structureInstances??[]).map(item=>item.id)),errors=[];for(const board of ensureBoardState(state)){if(!board.ownerKnowledgeId)errors.push(`board ${board.id} 缺少 ownerKnowledgeId`);if(board.frames.length>256)errors.push(`board ${board.id} 超过 256 个 frame`);for(const frame of board.frames){if(!instances.has(frame.instanceId))errors.push(`frame ${frame.id} 引用不存在的结构 ${frame.instanceId}`);if(!Number.isFinite(frame.x)||!Number.isFinite(frame.y))errors.push(`frame ${frame.id} 坐标无效`)}}return{valid:!errors.length,errors}}
