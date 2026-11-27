import { mathKnowledgeById, mathProblemById, MATH_METHODS } from '../learning/math-content.js';
import { readProgress, recordReading } from '../learning/reading-progress.js';
import { mountReadingFrame, readingLink, readingPanel } from './reading-frame.js';

export function connectCourseReading({ course, guide, archive, controller, activeChapter, onRead, experimentFor }) {
  const units = course.chapters.flatMap(chapter => chapter.groups.map(group => ({
    chapter, knowledge: mathKnowledgeById(group.id), problem: mathProblemById(group.problemIds[0])
  })));
  const sections = [...guide.querySelectorAll('[data-course-reading]')];
  const indexFor = id => units.findIndex(unit => unit.knowledge.id === id);
  const saved = readProgress()[course.id];
  const initial = activeChapter ? units.findIndex(unit => unit.chapter.id === activeChapter) : indexFor(saved?.unitId);
  let current = Math.max(initial, 0);
  let timer, frame, pendingRestore, programmatic = false, lastSaved;
  const chooseChapter = guide.querySelector('#courseChapterJump');
  const chapterLabel = chooseChapter.closest('label');
  const sectionLabel = document.createElement('label');
  sectionLabel.textContent = '小节';
  const chooseSection = document.createElement('select');
  sectionLabel.append(chooseSection);
  const indicators = document.createElement('p');
  indicators.className = 'reading-progress';
  indicators.setAttribute('aria-live', 'polite');
  const left = readingPanel('课程目录', 'left', chapterLabel, sectionLabel, indicators);
  const links = document.createElement('div');
  const right = readingPanel('相关资料', 'right', links);
  const controls = document.createElement('div');
  controls.className = 'course-page-turn';
  const previous = readingLink('上一节', () => jump(current - 1, { focus: true }));
  const next = readingLink('下一节', () => jump(current + 1, { focus: true }));
  controls.append(previous, next);
  left.append(controls);
  mountReadingFrame(guide, left, right);
  const readingTop=()=>archive.getBoundingClientRect().top
    +(matchMedia('(min-width: 1140px)').matches?0:left.getBoundingClientRect().height+8);

  function refresh() {
    const {chapter, knowledge, problem} = units[current];
    chooseChapter.value = chapter.id;
    if (chooseSection.dataset.chapter !== chapter.id) {
      chooseSection.dataset.chapter = chapter.id;
      chooseSection.replaceChildren(...chapter.groups.map(item => new Option(
        mathKnowledgeById(item.id).title.replace(/\$([^$]+)\$/g, '$1'), item.id
      )));
    }
    chooseSection.value = knowledge.id;
    previous.disabled = current === 0;
    next.disabled = current === units.length - 1;
    const items = [readingLink('知识 · ' + knowledge.title, () => controller.openMathArchive('knowledge', knowledge.id))];
    items.push(readingLink('阅读本节讲义', () => {
      const companion=sections[current].querySelector('[data-reading-guide]');
      const body=sections[current].querySelector('.math-reading-body');
      if(companion)companion.open=true;
      (companion??body)?.scrollIntoView({block:'start'});
    }));
    const method = MATH_METHODS.find(item => item.knowledgeIds.includes(knowledge.id));
    if (method) items.push(readingLink('方法 · ' + method.title, () => controller.openMathArchive('method', method.id)));
    if (problem) items.push(readingLink('习题 · ' + problem.title, () => controller.openMathArchive('problem', problem.id)));
    const experiment = experimentFor?.(knowledge.id);
    if (experiment) items.push(readingLink('实验 · ' + experiment.title, () => controller.openMathArchive('discovery', experiment.id)));
    links.replaceChildren(...items);
  }

  function persist() {
    window.clearTimeout(timer);
    if (!guide.isConnected || guide.closest('#mathArchive').classList.contains('hidden')) return;
    const {knowledge} = units[current];
    const offset = Math.max(0, readingTop() - sections[current].getBoundingClientRect().top);
    const rounded = Math.round(offset);
    if (lastSaved?.id === knowledge.id && lastSaved.offset === rounded) return;
    const saved = recordReading(course.id, knowledge.id, rounded);
    lastSaved = { id: knowledge.id, offset: rounded };
    indicators.textContent = '已打开 ' + saved.opened.filter(id => indexFor(id) >= 0).length + ' / ' + units.length + ' 节';
  }

  function schedulePosition() {
    if (programmatic || pendingRestore) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!guide.isConnected) return;
      const line = readingTop() + 70;
      let closest = current;
      for (const [index, item] of sections.entries()) {
        if (!item.closest('.math-chapter-card').open) continue;
        const rect = item.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) { closest = index; break; }
      }
      if (current !== closest) {
        current = closest;
        refresh();
      }
      clearTimeout(timer);
      timer = setTimeout(persist, 160);
    });
  }

  function jump(index, { offset = 0, focus = false } = {}) {
    if (!units[index]) return;
    pendingRestore = null;
    current = index;
    guide.open = true;
    sections[index].closest('.math-chapter-card').open = true;
    const position = () => {
      if (!guide.isConnected || current !== index) return;
      const rect = sections[index].getBoundingClientRect();
      archive.scrollTop += rect.top - readingTop() + Math.min(offset, Math.max(rect.height - 32, 0));
      if (focus) sections[index].querySelector('h3')?.focus({preventScroll:true});
    };
    programmatic = true;
    const reading = onRead(sections[index]);
    refresh();
    requestAnimationFrame(() => {
      position();
      if (offset && reading) {
        const restoration = pendingRestore = Promise.resolve(reading).finally(() => {
          if (pendingRestore !== restoration) return;
          position();
          pendingRestore = null;
          persist();
        });
      } else persist();
      programmatic = false;
    });
  }

  function select(index){
    if(!matchMedia('(min-width: 1140px)').matches)left.open=false;
    jump(index);
  }
  chooseChapter.onchange = () => select(units.findIndex(unit => unit.chapter.id === chooseChapter.value));
  chooseSection.onchange = () => select(indexFor(chooseSection.value));
  refresh();
  const events = new AbortController();
  archive.addEventListener('scroll', schedulePosition, { passive: true, signal: events.signal });
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      onRead(entry.target);
      visibility.unobserve(entry.target);
    }
  }, { root: archive, rootMargin:'300px 0px' });
  sections.forEach(section => visibility.observe(section));
  onRead(sections[current]);
  if (activeChapter || initial >= 0 && (current !== 0 || saved.offset)) jump(current, { offset: activeChapter ? 0 : saved.offset });
  else requestAnimationFrame(persist);

  return () => {
    persist();
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    pendingRestore = null;
    visibility.disconnect();
    events.abort();
  };
}

