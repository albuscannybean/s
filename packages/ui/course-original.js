import { textbookForSource } from '../learning/textbook-editions.js';
import { renderStudyMarkdown } from './math-markup.js';
import { mountParagraphNotes } from './reading-editor.js';

const location = new URL('../../apps/web/course-text/', import.meta.url);
const schema = 'lmn-course-text/1';
let manifest;
let suffix = '.json';
const editions = new Map();

async function json(name) {
  const response = await fetch(new URL(name, location));
  if (!response.ok) throw new Error('教材正文文件读取失败。');
  if (!name.endsWith('.gz')) return response.json();
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}

export function courseTextManifest() {
  manifest ??= json('manifest.json')
    .then(data => {
      if (data.format !== schema || !Array.isArray(data.editions)) return new Set();
      suffix = data.encoding === 'gzip' ? '.json.gz' : '.json';
      return new Set(data.editions);
    })
    .catch(() => { manifest = null; return new Set(); });
  return manifest;
}

export async function loadCourseTextEdition(edition) {
  if (!(await courseTextManifest()).has(edition.id)) return {};
  if (!editions.has(edition.id)) {
    editions.set(edition.id, json(edition.id + suffix).then(data => {
      if (data.format !== schema || data.edition !== edition.sha256 || !data.sections || typeof data.sections !== 'object') {
        throw new Error('教材正文与课程使用的版本不一致。');
      }
      return data.sections;
    }).catch(error => {
      editions.delete(edition.id);
      throw error;
    }));
  }
  return editions.get(edition.id);
}

function mountText(root, text, index) {
  const p = root.ownerDocument.createElement('p');
  if (index) p.dataset.sourcePage = index;
  p.textContent = text;
  root.append(p);
}

function mountPlainSource(root, text) {
  // Older local drafts were stored as page text inside Markdown code fences.
  const prose = text.replace(/^### 原书 PDF 第 (\d+) 页\s*$/gm, '')
    .replace(/^```(?:text)?\s*$/gm, '').trim();
  for (const paragraph of prose.split(/\n{2,}/)) mountText(root, paragraph);
}

export async function mountCourseOriginal(target, unit, { readLocalText, readNotes, saveNotes, onDisplay } = {}) {
  const edition = textbookForSource(unit.source);
  const localText = readLocalText?.();
  if (!edition && !localText) return;
  const active = () => target.isConnected && !target.closest('#mathArchive')?.classList.contains('hidden');
  const show = (description, content) => {
    if (!active() || !content.childElementCount) return;
    const heading = document.createElement('h4');
    heading.textContent = '教材正文';
    const source = document.createElement('p');
    source.className = 'course-original-source';
    source.textContent = description;
    target.replaceChildren(heading, source, content);
    mountParagraphNotes(content, { readNotes, saveNotes });
    target.hidden = false;
    onDisplay?.();
  };
  const makeBody = () => {
    const prose = document.createElement('div');
    prose.className = 'course-original-prose';
    return prose;
  };
  if (edition && (await courseTextManifest()).has(edition.id)) {
    try {
      if (!active()) return;
      const sections = await loadCourseTextEdition(edition);
      if (!active()) return;
      const section = sections[unit.source.section];
      if (section?.pages?.length) {
        const prose = makeBody();
        for (const [page, blocks] of section.pages) {
          for (const block of blocks) {
            if (typeof block === 'string') mountText(prose, block, page);
            else if (typeof block?.latex === 'string') {
              const fragment = document.createElement('div');
              renderStudyMarkdown(fragment, block.latex);
              for (const child of [...fragment.children]) {
                child.dataset.sourcePage = page;
                prose.append(child);
              }
            }
          }
        }
        const quality = section.reviewed ? '已校订' : section.scanned ? '扫描文字待校订' : '提取文字待校订';
        show(edition.title + ' · ' + quality, prose);
        return;
      }
    } catch (error) {
      if (active() && !localText) {
        target.hidden = false;
        target.textContent = error.message;
      }
    }
  }
  if (localText) {
    const prose = makeBody();
    mountPlainSource(prose, localText);
    show('已保存的教材文字稿 · 待校订', prose);
  }
}

