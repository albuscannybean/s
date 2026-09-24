import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMapNodes} from '../packages/navigation/structure-map.js';
const slots=['A','B','C'].map(id=>({id}));
const edge=(sourceSlotId,targetSlotId,direction='directed',arrow='direction')=>({sourceSlotId,targetSlotId,direction,visual:{arrow}});
test('map follows outgoing arrows, offers branches, and deduplicates parallel destinations',()=>{
 const definition={slots,edges:[edge('A','B'),edge('A','C'),edge('A','B'),edge('C','A')]};
 assert.deepEqual(nextMapNodes(definition,'A').map(n=>n.id),['B','C']);
 assert.equal(nextMapNodes(definition,'A')[0].edges.length,2);
 assert.deepEqual(nextMapNodes(definition,'B'),[]);
});
test('map respects visible arrow overrides, bidirectional edges, loops and missing endpoints',()=>{
 const definition={slots,edges:[edge('A','B','directed','reverse'),edge('A','C','bidirectional'),edge('A','B','undirected'),edge('A','A'),edge('A','missing'),edge('A','B','directed','none')]};
 assert.deepEqual(nextMapNodes(definition,'A').map(n=>n.id),['C','A']);
 assert.deepEqual(nextMapNodes(definition,'B').map(n=>n.id),['A']);
 assert.deepEqual(nextMapNodes(definition,'C').map(n=>n.id),['A']);
 assert.deepEqual(nextMapNodes(definition,null),[]);
});
