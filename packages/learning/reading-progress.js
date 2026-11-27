const key = 'lmn:math-reading-progress';

export function readProgress(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(key) || '{}');
    return raw && !Array.isArray(raw) && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function recordReading(courseId, unitId, offset, storage = globalThis.localStorage, at = Date.now()) {
  const progress = readProgress(storage);
  const previous = progress[courseId];
  const opened = Array.isArray(previous?.opened) ? previous.opened : [];
  const position = { unitId, offset: Math.max(0, Math.round(offset) || 0), opened: [...new Set([...opened, unitId])], at };
  try {
    storage.setItem(key, JSON.stringify({ ...progress, [courseId]: position }));
  } catch {
    // A browser that disallows local storage can still continue reading during this visit.
  }
  return position;
}

export function mergeReadingProgress(incoming, storage = globalThis.localStorage) {
  const progress = readProgress(storage);
  for (const [courseId, position] of Object.entries(incoming)) {
    const local = progress[courseId];
    const latest = local?.at > position.at ? local : position;
    progress[courseId] = { ...latest, opened:[...new Set([...(local?.opened ?? []), ...position.opened])] };
  }
  storage.setItem(key, JSON.stringify(progress));
}

