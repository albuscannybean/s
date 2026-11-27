import { TEXTBOOK_EDITIONS } from '../learning/textbook-editions.js';
import { appendInlineContent, renderStudyMarkdown } from './math-markup.js';
import { mountReadingEditor } from './reading-editor.js';
import { attachTextbooks, deletePageNote, getTextbook, pageNotes, savePageNote } from './textbook-shelf.js';

const vendor = new URL('../../apps/web/vendor/pdfjs/', import.meta.url);
const absolute = relative => new URL(relative, vendor).href;
let pdfModule;

async function loadEngine() {
  pdfModule ??= import(absolute('build/pdf.min.mjs')).catch(error => {
    pdfModule = null;
    throw error;
  });
  const pdf = await pdfModule;
  pdf.GlobalWorkerOptions.workerSrc = absolute('build/pdf.worker.min.mjs');
  return pdf;
}

const option = (label, value) => new Option(label, value);
const clamp = (value, max) => Math.min(Math.max(1, Math.floor(Number(value) || 1)), max);

export function mountTextbookReader(root, {
  books = TEXTBOOK_EDITIONS, bookId = books[0].id, page, onReady, practiceSection
} = {}) {
  const initialBook = books.find(item => item.id === bookId) ?? books[0];
  let book = initialBook, currentPage = clamp(page ?? book.chapters[0]?.sections[0]?.page, book.pages);
  let loading, document, pdf, source, renderTask, textLayer, request = 0, quote = null, zoom = 1, editingNote;
  let saveInProgress = false;
  const positions = new Map([[book.id, currentPage]]);
  const doc = root.ownerDocument;
  const selection = () => doc.getSelection();
  const events = new AbortController();
  root.innerHTML = `
    <div class="book-toolbar">
      <label>教材 <select data-book></select></label>
      <button type="button" data-attach>连接教材</button>
      <input type="file" data-files hidden multiple accept=".pdf,.lmn-books,application/pdf">
      <label>小节 <select data-section></select></label>
    </div>
    <div class="book-toolbar book-controls" hidden>
      <button type="button" data-prev aria-label="上一页">‹</button>
      <label>PDF 页 <input data-page type="number" min="1" inputmode="numeric"></label>
      <span data-total></span>
      <button type="button" data-next aria-label="下一页">›</button>
      <label class="book-zoom">缩放 <select data-zoom><option value="1">适应宽度</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
      <button type="button" data-note>添加批注</button>
      <button type="button" data-practice hidden>本节练习</button>
    </div>
    <p class="book-status" role="status"></p>
    <div class="book-scroll" hidden>
      <div class="book-paper" aria-label="教材原页">
        <div class="book-highlights" aria-hidden="true"></div>
        <button type="button" class="book-selection" hidden>添加批注</button>
      </div>
    </div>
    <details class="book-notes" hidden><summary>本页批注</summary><div class="book-note-list"></div></details>
    <dialog class="book-note-dialog" aria-label="教材批注">
      <form>
        <h3>教材批注</h3>
        <blockquote hidden></blockquote>
        <div class="book-note-editor"></div>
        <p class="book-note-error" role="status"></p>
        <div class="book-note-actions">
          <button type="button" data-delete hidden>删除批注</button>
          <button type="button" data-cancel>取消</button>
          <button type="submit" class="primary">保存批注</button>
        </div>
      </form>
    </dialog>`;
  const find = selector => root.querySelector(selector);
  const selectBook = find('[data-book]'), jump = find('[data-page]'), sections = find('[data-section]');
  const controls = find('.book-controls'), scroll = find('.book-scroll'), paper = find('.book-paper');
  const notePanel = find('.book-notes'), highlights = find('.book-highlights'), selectNote = find('.book-selection');
  const dialog = find('dialog'), form = find('form'), noteEditor = find('.book-note-editor');
  const previous = find('[data-prev]'), next = find('[data-next]'), showNotes = find('[data-note]');
  const status = message => { find('.book-status').textContent = message; };
  const practice = find('[data-practice]');
  const files = find('[data-files]');
  selectBook.replaceChildren(...books.map(item => option(item.title, item.id)));
  find('[data-attach]').onclick = () => files.click();

  function fillSections() {
    sections.replaceChildren(option('选择小节', ''));
    for (const chapter of book.chapters) {
      const group = doc.createElement('optgroup');
      group.label = chapter.number + ' ' + chapter.title;
      group.append(...chapter.sections.map(section => option(section.section + ' ' + section.title, section.page)));
      sections.append(group);
    }
  }
  function syncControls() {
    jump.max = book.pages;
    jump.value = currentPage;
    find('[data-total]').textContent = '/ ' + book.pages;
    previous.disabled = currentPage === 1;
    next.disabled = currentPage === book.pages;
    const practiceAction = practiceSection?.(book, currentPage);
    practice.hidden = !practiceAction;
    practice.onclick = practiceAction ?? null;
    const start = [...sections.options].reduce((best, item) =>
      Number(item.value) <= currentPage && Number(item.value) >= Number(best) ? item.value : best, '');
    sections.value = start;
  }
  function stopRender() {
    request++;
    renderTask?.cancel();
    textLayer?.cancel();
    renderTask = textLayer = null;
    quote = null;
    selectNote.hidden = true;
  }

  async function open(id, requestedPage) {
    const old = loading;
    stopRender();
    if (dialog.open) dialog.close();
    loading = document = pdf = source = null;
    controls.hidden = notePanel.hidden = scroll.hidden = true;
    scroll.scrollLeft = 0;
    book = books.find(item => item.id === id) ?? initialBook;
    selectBook.value = book.id;
    currentPage = clamp(requestedPage ?? positions.get(book.id) ?? book.chapters[0]?.sections[0]?.page, book.pages);
    fillSections();
    syncControls();
    status('正在查找已连接的教材…');
    const token = request;
    try {
      await old?.destroy();
      const local = await getTextbook(book.id);
      if (token !== request || !root.isConnected) return;
      if (!local) {
        status('连接原始 PDF 或教材原页包后，即可在这里翻阅全书。文件只保存在当前浏览器。');
        return;
      }
      status('正在打开教材…');
      const engine = await loadEngine();
      const data = new Uint8Array(await local.pdf.arrayBuffer());
      if (token !== request || !root.isConnected) return;
      const task = loading = engine.getDocument({
        data, cMapUrl: absolute('cmaps/'), cMapPacked: true,
        standardFontDataUrl: absolute('standard_fonts/'), wasmUrl: absolute('wasm/'),
        iccUrl: absolute('iccs/'), isEvalSupported: false, enableXfa: false
      });
      const opened = await task.promise;
      if (token !== request || !root.isConnected) return;
      pdf = engine;
      source = local;
      document = opened;
      controls.hidden = scroll.hidden = false;
      onReady?.();
      await draw();
    } catch (error) {
      if (token === request) status('无法打开教材。' + error.message);
    }
  }

  async function draw() {
    if (!document || !root.isConnected || !root.clientWidth) return;
    stopRender();
    syncControls();
    const token = request, number = currentPage;
    positions.set(book.id, number);
    status('正在排版第 ' + number + ' 页…');
    paper.setAttribute('aria-busy', 'true');
    showNotes.disabled = true;
    highlights.replaceChildren();
    paper.querySelectorAll('canvas, .textLayer').forEach(node => node.remove());
    find('.book-note-list').replaceChildren();
    notePanel.hidden = true;
    try {
      const pdfPage = await document.getPage(number);
      if (token !== request || !root.isConnected) return;
      const width = Math.min(850, scroll.clientWidth) * zoom;
      const viewport = pdfPage.getViewport({ scale: width / pdfPage.getViewport({ scale: 1 }).width });
      paper.style.width = viewport.width + 'px';
      paper.style.height = viewport.height + 'px';
      paper.style.setProperty('--total-scale-factor', viewport.scale);
      const canvas = doc.createElement('canvas');
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      paper.prepend(canvas);
      renderTask = pdfPage.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await renderTask.promise;
      if (token !== request || !root.isConnected) return;
      const layer = doc.createElement('div');
      layer.className = 'textLayer';
      paper.insertBefore(layer, highlights);
      const lines = source.ocr?.[number - 1];
      if (lines?.length) {
        layer.classList.add('book-ocr-layer');
        layer.setAttribute('aria-label', '扫描页的 OCR 选文层');
        for (const [x, y, w, h, text] of lines) {
          const line = doc.createElement('span');
          line.textContent = text;
          Object.assign(line.style, {
            left: x * 100 + '%', top: y * 100 + '%',
            fontSize: Math.max(h * viewport.height * 0.83, 1) + 'px'
          });
          layer.append(line);
          const textWidth = line.scrollWidth;
          if (textWidth > 0) line.style.transform = 'scaleX(' + (w * viewport.width / textWidth) + ')';
        }
      } else {
        textLayer = new pdf.TextLayer({ textContentSource: pdfPage.streamTextContent(), container: layer, viewport });
        await textLayer.render();
      }
      if (token !== request || !root.isConnected) return;
      await refreshNotes();
      if (token !== request) return;
      status(lines?.length ? '扫描原页 · 选文使用 OCR。' : layer.querySelector('span') ? '' : '本页无可选文字。可添加整页批注。');
      showNotes.disabled = false;
    } catch (error) {
      if (token === request) status('无法显示这一页。' + error.message);
    } finally {
      if (token === request) paper.removeAttribute('aria-busy');
    }
  }

  async function refreshNotes() {
    const token = request;
    const notes = await pageNotes(book.sha256, currentPage);
    if (token !== request) return;
    highlights.replaceChildren();
    const list = find('.book-note-list');
    list.replaceChildren();
    for (const note of notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      for (const rect of note.rects) {
        const mark = doc.createElement('span');
        const [x, y, w, h] = rect.map(n => n * 100 + '%');
        Object.assign(mark.style, { left: x, top: y, width: w, height: h });
        highlights.append(mark);
      }
      const item = doc.createElement('article');
      const edit = doc.createElement('button');
      edit.type = 'button';
      edit.textContent = note.quote || '整页批注';
      edit.onclick = () => editNote(note);
      const body = doc.createElement('div');
      body.className = 'math-reading-body';
      renderStudyMarkdown(body, note.body);
      item.append(edit, body);
      list.append(item);
    }
    notePanel.hidden = !notes.length;
    notePanel.querySelector('summary').textContent = '本页批注（' + notes.length + '）';
  }

  function readSelection() {
    const selected = selection();
    const layer = paper.querySelector('.textLayer');
    if (!selected?.rangeCount || selected.isCollapsed || !layer?.contains(selected.anchorNode)
      || !layer.contains(selected.focusNode)) return null;
    const text = selected.toString().trim();
    if (!text) return null;
    const bounds = paper.getBoundingClientRect();
    const rects = Array.from(selected.getRangeAt(0).getClientRects()).flatMap(rect => {
      const left = Math.max(rect.left, bounds.left), right = Math.min(rect.right, bounds.right);
      const top = Math.max(rect.top, bounds.top), bottom = Math.min(rect.bottom, bounds.bottom);
      return right > left && bottom > top
        ? [[(left - bounds.left) / bounds.width, (top - bounds.top) / bounds.height,
          (right - left) / bounds.width, (bottom - top) / bounds.height]]
        : [];
    });
    return { quote: text.slice(0, 6000), rects };
  }

  function positionSelection() {
    quote = readSelection();
    selectNote.hidden = !quote?.rects.length;
    if (selectNote.hidden) return;
    const [x, y] = quote.rects[0];
    selectNote.style.left = Math.max(0, Math.min(x * paper.clientWidth, paper.clientWidth - selectNote.offsetWidth)) + 'px';
    selectNote.style.top = Math.max(0, y * paper.clientHeight - selectNote.offsetHeight - 4) + 'px';
  }

  function editNote(note) {
    if (dialog.open || showNotes.disabled) return;
    const excerpt = note ?? (readSelection() || quote);
    editingNote = note ?? {
      id: crypto.randomUUID(), edition: book.sha256, page: currentPage, quote: excerpt?.quote ?? '',
      rects: excerpt?.rects ?? [], createdAt: new Date().toISOString()
    };
    selection()?.removeAllRanges();
    const citation = dialog.querySelector('blockquote');
    citation.textContent = editingNote.quote;
    citation.hidden = !editingNote.quote;
    find('[data-delete]').hidden = !note;
    find('.book-note-error').textContent = '';
    noteEditor.replaceChildren();
    const editor = mountReadingEditor(noteEditor, { text: note?.body ?? '', label: '批注文字', limit: 12000, onChange: () => {} });
    dialog.showModal();
    editor.input.focus();
  }
  async function persist(action) {
    if (saveInProgress) return;
    saveInProgress = true;
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    try {
      await action();
      dialog.close();
      await refreshNotes();
      notePanel.open = !notePanel.hidden;
    } catch (error) {
      find('.book-note-error').textContent = '无法保存批注。' + (error?.message ?? '');
    } finally {
      saveInProgress = false;
      for (const button of form.querySelectorAll('button')) button.disabled = false;
    }
  }

  form.onsubmit = event => {
    event.preventDefault();
    const body = noteEditor.querySelector('textarea').value.trim();
    if (!body) { find('.book-note-error').textContent = '请填写批注内容。'; return; }
    void persist(() => savePageNote({ ...editingNote, body }));
  };
  dialog.addEventListener('cancel', event => { if (saveInProgress) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (root.isConnected) showNotes.focus({ preventScroll: true }); });
  find('[data-cancel]').onclick = () => dialog.close();
  find('[data-delete]').onclick = () => {
    if (globalThis.confirm('删除这条教材批注？')) void persist(() => deletePageNote(editingNote.id));
  };
  doc.addEventListener('selectionchange', positionSelection, { signal: events.signal });
  selectNote.addEventListener('pointerdown', event => event.preventDefault());
  selectNote.onclick = () => editNote();
  showNotes.onclick = () => editNote();
  selectBook.onchange = () => { void open(selectBook.value); };
  function go(number) {
    currentPage = clamp(number, book.pages);
    if (document) void draw();
    else { syncControls(); positions.set(book.id, currentPage); }
  }
  jump.onchange = () => go(jump.value);
  sections.onchange = () => { if (sections.value) go(sections.value); };
  previous.onclick = () => go(currentPage - 1);
  next.onclick = () => go(currentPage + 1);
  find('[data-zoom]').onchange = event => {
    zoom = Number(event.target.value);
    void draw();
  };
  files.onchange = async () => {
    const selected = Array.from(files.files);
    files.value = '';
    if (!selected.length) return;
    const attachButton = find('[data-attach]');
    attachButton.disabled = true;
    status('正在核对版本并保存到本机…');
    try {
      const result = await attachTextbooks(selected, TEXTBOOK_EDITIONS.includes(books[0]) ? TEXTBOOK_EDITIONS : books);
      if (!root.isConnected) return;
      const preferred = result.attached.includes(book.id) ? book.id : books.find(item => result.attached.includes(item.id))?.id;
      if (preferred) await open(preferred);
      if (result.skipped.length) status('以下文件与课程使用的版本不匹配。' + result.skipped.join('、'));
      else if (!preferred) status('教材已保存，可以从对应课程打开。');
    } catch (error) {
      status('连接失败。' + error.message);
    } finally {
      attachButton.disabled = false;
    }
  };

  let width = 0;
  const resize = new ResizeObserver(() => {
    const nextWidth = scroll.clientWidth;
    if (nextWidth && width !== nextWidth) {
      const previousWidth = width;
      width = nextWidth;
      if (previousWidth) void draw();
    }
  });
  resize.observe(scroll);
  void open(book.id, page);
  return {
    destroy() {
      events.abort();
      resize.disconnect();
      if (dialog.open) dialog.close();
      stopRender();
      void loading?.destroy().catch(() => {});
    }
  };
}

