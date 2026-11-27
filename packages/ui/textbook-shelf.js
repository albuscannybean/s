const scope = new URL('../../apps/web/', import.meta.url).pathname;
let database;

function openShelf() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('lmn-textbook-shelf:' + scope, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('editions', { keyPath: 'id' });
      const notes = db.createObjectStore('notes', { keyPath: 'id' });
      notes.createIndex('page', ['edition', 'page']);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null; };
      resolve(request.result);
    };
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}

async function run(store, mode, action) {
  const db = await openShelf();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = () => reject(tx.error);
  });
}

export const getTextbook = id => run('editions', 'readonly', store => store.get(id));
export const hasTextbook = id => run('editions', 'readonly', store => store.getKey(id)).then(Boolean);
export const pageNotes = (edition, page) => run('notes', 'readonly', store => store.index('page').getAll([edition, page]));
export const allPageNotes = () => run('notes', 'readonly', store => store.getAll());
export const savePageNote = note => run('notes', 'readwrite', store => store.put(note));
export const deletePageNote = id => run('notes', 'readwrite', store => store.delete(id));
export function mergePageNotes(notes) {
  return run('notes', 'readwrite', store => {
    for (const note of notes) {
      const existing=store.getKey(note.id);
      existing.onsuccess=()=>{if(existing.result===undefined)store.add(note);};
    }
  });
}

async function identify(pdf, editions) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await pdf.arrayBuffer()));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  return editions.find(book => book.sha256 === hash);
}

async function unpack(file, editions) {
  const header = await file.slice(0, 20).arrayBuffer();
  if (header.byteLength !== 20 || new TextDecoder().decode(header.slice(0, 16)) !== 'LMN-TEXTBOOKS/1\n') {
    throw new Error('请选择 LMN 教材原页包或原始 PDF。');
  }
  const size = new DataView(header).getUint32(16, true);
  if (!size || size > 16384) throw new Error('教材原页包目录无效。');
  const items = JSON.parse(await file.slice(20, 20 + size).text());
  if (!Array.isArray(items) || !items.length || items.length > editions.length) throw new Error('教材原页包目录无效。');
  const records = [];
  let offset = 20 + size;
  for (const item of items) {
    const edition = editions.find(book => book.id === item.id);
    const validSize = length => Number.isSafeInteger(length) && length >= 0;
    if (!edition || records.some(book => book.id === item.id) || !validSize(item.pdf) || !validSize(item.ocr)
      || offset + item.pdf + item.ocr > file.size) throw new Error('教材原页包存在无效条目。');
    const pdf = file.slice(offset, offset + item.pdf, 'application/pdf');
    offset += item.pdf;
    if (await identify(pdf, [edition]) !== edition) throw new Error('教材原页校验失败，请重新选择原文件。');
    const ocr = item.ocr ? JSON.parse(await file.slice(offset, offset + item.ocr).text()) : null;
    offset += item.ocr;
    if (ocr && (!Array.isArray(ocr) || ocr.length !== edition.pages || ocr.some(page =>
      !Array.isArray(page) || page.some(line => !Array.isArray(line) || line.length !== 5
        || line.slice(0, 4).some(value => !Number.isFinite(value) || value < 0 || value > 1)
        || typeof line[4] !== 'string')))) throw new Error('扫描教材的选文层无效。');
    records.push({ id: edition.id, pdf, ocr });
  }
  if (offset !== file.size) throw new Error('教材原页包长度无效。');
  return records;
}

export async function attachTextbooks(files, editions) {
  const records = new Map();
  const skipped = [];
  for (const file of files) {
    if (/\.lmn-books$/i.test(file.name)) {
      for (const book of await unpack(file, editions)) records.set(book.id, book);
      continue;
    }
    const book = await identify(file, editions);
    if (!book) { skipped.push(file.name); continue; }
    if (!records.has(book.id)) records.set(book.id, { id: book.id, pdf: file });
  }
  // Reattaching an original PDF preserves any previously imported selection layer.
  await run('editions', 'readwrite', store => {
    for (const record of records.values()) {
      if ('ocr' in record) store.put(record);
      else {
        const previous = store.get(record.id);
        previous.onsuccess = () => store.put({ ...previous.result, ...record });
      }
    }
  });
  return { attached: [...records.keys()], skipped };
}

