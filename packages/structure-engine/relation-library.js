export const RELATION_TYPES=Object.freeze([
  {id:'related',label:'Related',direction:'undirected',routing:'bezier'},
  {id:'defines',label:'Defines',direction:'directed',routing:'bezier'},
  {id:'depends-on',label:'Depends on',direction:'directed',routing:'orthogonal'},
  {id:'contains',label:'Contains',direction:'directed',routing:'orthogonal'},
  {id:'equivalent',label:'Equivalent',direction:'bidirectional',routing:'straight'},
  {id:'cover',label:'Cover relation',direction:'directed',routing:'straight',semanticAxis:'order'},
  {id:'maps-to',label:'Maps to',direction:'directed',routing:'bezier'},
  {id:'successor',label:'Successor',direction:'cyclic',routing:'radial-arc'},
  {id:'proves',label:'Proves',direction:'directed',routing:'orthogonal'},
  {id:'transforms',label:'Transforms',direction:'directed',routing:'bezier'}
]);
export const getRelationType=id=>RELATION_TYPES.find(item=>item.id===id)??RELATION_TYPES[0];
