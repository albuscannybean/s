export const SCHEMA_VERSION = 1;
export const LMN_POSITIONS = Object.freeze([
  { id: 'L1', group: 'L', name: '本质 / Essence' },
  { id: 'L2', group: 'L', name: '存在 / Existence' },
  { id: 'L3', group: 'L', name: '存在者 / Existential' },
  { id: 'L4', group: 'L', name: '语言 / Language' },
  { id: 'M1', group: 'M', name: '定义 / Definition' },
  { id: 'M2', group: 'M', name: '构成 / Constitution' },
  { id: 'M3', group: 'M', name: '实现 / Realization' },
  { id: 'N1', group: 'N', name: '内涵 / Intension' },
  { id: 'N2', group: 'N', name: '结构 / Structure' }
]);

const uid = () => globalThis.crypto?.randomUUID?.() ?? `lmn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now = () => new Date().toISOString();

export function createKnowledge(title, content = '') {
  if (!String(title).trim()) throw new Error('Knowledge title is required');
  const timestamp = now();
  return { id: uid(), title: String(title).trim(), content, createdAt: timestamp, updatedAt: timestamp };
}

export function createRelation(sourceId, targetId, type = 'related', label = '') {
  if (!sourceId || !targetId) throw new Error('Relation endpoints are required');
  return { id: uid(), sourceId, targetId, type, label, createdAt: now() };
}

export function createRepresentation(knowledgeId, kind, data = {}) {
  if (!knowledgeId || !['text', 'freeform', 'lmn', 'structure'].includes(kind)) throw new Error('Invalid representation');
  return { id: uid(), knowledgeId, kind, data, createdAt: now(), updatedAt: now() };
}

export function createLMN(knowledgeId) {
  return {
    id: uid(), knowledgeId, createdAt: now(), updatedAt: now(),
    positions: Object.fromEntries(LMN_POSITIONS.map(p => [p.id, { position: p.id, knowledgeId: null, note: '' }]))
  };
}

export function createNamedKnowledge(title, content = '') {
  const knowledge = createKnowledge(title, content);
  return { knowledge, lmn: createLMN(knowledge.id) };
}

export function ensureRootLMNs(knowledge, lmns) {
  const result = [...lmns];
  const existing = new Set(result.map(l => l.knowledgeId));
  for (const item of knowledge) if (!existing.has(item.id)) result.push(createLMN(item.id));
  return result;
}

export function validateLMN(lmn) {
  const keys = Object.keys(lmn?.positions ?? {}).sort();
  const expected = LMN_POSITIONS.map(p => p.id).sort();
  return { valid: keys.length === 9 && expected.every((x, i) => keys[i] === x), errors: keys.length === 9 && expected.every((x, i) => keys[i] === x) ? [] : ['LMN 必须严格包含 L1–L4、M1–M3、N1–N2'] };
}

export function neighborhood(knowledge, relations, rootId, depth = 2) {
  const byId = new Map(knowledge.map(k => [k.id, k]));
  const visited = new Set([rootId]);
  let frontier = [rootId];
  for (let level = 0; level < Math.max(0, depth); level++) {
    const next = [];
    for (const id of frontier) for (const r of relations) {
      const other = r.sourceId === id ? r.targetId : r.targetId === id ? r.sourceId : null;
      if (other && !visited.has(other)) { visited.add(other); next.push(other); }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { nodes: [...visited].map(id => byId.get(id)).filter(Boolean), edges: relations.filter(r => visited.has(r.sourceId) && visited.has(r.targetId)) };
}

export function connectedComponents(knowledge, relations) {
  const unseen = new Set(knowledge.map(k => k.id));
  const result = [];
  while (unseen.size) {
    const start = unseen.values().next().value;
    const component = neighborhood(knowledge, relations, start, knowledge.length + 1).nodes.map(n => n.id);
    component.forEach(id => unseen.delete(id));
    result.push(component);
  }
  return result;
}

export function detectCycle(nodeIds, edges) {
  const graph = new Map(nodeIds.map(id => [id, []]));
  edges.forEach(e => graph.get(e.sourceId)?.push(e.targetId));
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of graph.get(id) ?? []) if (visit(child)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return nodeIds.some(visit);
}

export function transitiveReduction(nodeIds, edges) {
  if (detectCycle(nodeIds, edges)) return { edges, warning: '偏序必须无环；当前关系未做约简' };
  const reduced = edges.filter((edge, index) => {
    const others = edges.filter((_, i) => i !== index);
    const seen = new Set([edge.sourceId]), queue = [edge.sourceId];
    while (queue.length) {
      const current = queue.shift();
      for (const candidate of others.filter(e => e.sourceId === current)) {
        if (candidate.targetId === edge.targetId) return false;
        if (!seen.has(candidate.targetId)) { seen.add(candidate.targetId); queue.push(candidate.targetId); }
      }
    }
    return true;
  });
  return { edges: reduced, warning: null };
}

export function exportBundle(state) {
  return { schema_version: SCHEMA_VERSION, exported_at: now(), application: 'LMN Knowledge System', ...structuredClone(state) };
}

export function validateImport(data) {
  const errors = [];
  if (data?.schema_version !== SCHEMA_VERSION) errors.push(`不支持 schema_version ${data?.schema_version}`);
  for (const key of ['knowledge', 'relations', 'representations', 'lmns', 'structures']) if (!Array.isArray(data?.[key])) errors.push(`${key} 必须为数组`);
  const ids = new Set((data?.knowledge ?? []).map(x => x.id));
  for (const r of data?.relations ?? []) if (!ids.has(r.sourceId) || !ids.has(r.targetId)) errors.push(`Relation ${r.id} 引用了缺失 Knowledge`);
  return { valid: errors.length === 0, errors };
}

export function mergeImport(current, incoming) {
  const result = structuredClone(current);
  for (const key of ['knowledge', 'relations', 'representations', 'lmns', 'structures']) {
    const map = new Map(result[key].map(x => [x.id, x]));
    for (const item of incoming[key]) map.set(item.id, item);
    result[key] = [...map.values()];
  }
  return result;
}

export function deletionImpact(state, knowledgeId) {
  return {
    relations: state.relations.filter(r => r.sourceId === knowledgeId || r.targetId === knowledgeId),
    representations: state.representations.filter(r => r.knowledgeId === knowledgeId),
    lmnReferences: state.lmns.flatMap(l => Object.values(l.positions).filter(p => p.knowledgeId === knowledgeId).map(p => ({ lmnId: l.id, position: p.position }))),
    structureReferences: state.structures.filter(s => (s.nodes ?? []).some(n => n.knowledgeId === knowledgeId))
  };
}
