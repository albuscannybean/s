import {TEXTBOOKS} from '../learning/textbooks.js';
import {appendInlineContent} from './math-markup.js';
import {mountInlinePlot} from './inline-plot.js';

export const courseBooks = {
  'course-algebra':['algebra'],
  'course-ode':['ode'],
  'course-probability':['prob'],
  'course-analysis-3':['analysis','a2','a3','a1'],
  'course-analysis-2':['analysis','a1','a2','a3']
};
const localCopies = new Map();
const selections = new Map();

function tag(parent, name, text) {
  const el = document.createElement(name);
  if (text) el.textContent = text;
  parent.append(el);
  return el;
}

export function textbookMatches(panel, query, courseId, exercisesOnly, openCourse) {
  const needle=query.trim().toLowerCase(), groups=[];
  for (const book of TEXTBOOKS) {
    if(courseId && !courseBooks[courseId]?.includes(book.id)) continue;
    const matches=[];
    for(const chapter of book.chapters) for(const section of chapter.sections) {
      if(exercisesOnly && !section.exercisePage && !section.exercises) continue;
      if([book.title,chapter.title,section.title,section.number,section.guide,section.topics].join(' ').toLowerCase().includes(needle))
        matches.push({chapter,section});
    }
    if(matches.length) groups.push({book,matches});
  }
  panel.replaceChildren();
  tag(panel,'summary',(exercisesOnly?'原书习题':'教材知识')+' · '+groups.reduce((n,g)=>n+g.matches.length,0)+' 节');
  const populate=()=>{
    if(!panel.open || panel.childElementCount>1) return;
    for(const {book,matches} of groups) {
      const list=tag(panel,'details');
      tag(list,'summary',book.title+'（'+matches.length+'）');
      const rows=tag(list,'div');rows.className='textbook-sources';
      for(const {chapter,section} of matches) {
        const link=tag(rows,'button');link.type='button';
        appendInlineContent(link,section.number+' '+section.title);
        link.onclick=()=>{
          const course=courseId??Object.keys(courseBooks).find(key=>courseBooks[key].includes(book.id));
          selections.set(course,{book:book.id,chapter:chapter.number,section:section.number});
          openCourse(course);
        };
      }
    }
  };
  panel.ontoggle=populate;
  populate();
}

export function mountTextbooks(root, courseId) {
  const books = courseBooks[courseId].map(id => TEXTBOOKS.find(book => book.id === id));
  const state = selections.get(courseId) ?? {book:books[0].id, chapter:courseId==='course-analysis-3'?'16':null};
  selections.set(courseId,state);
  root.className = 'textbook-reader math-reading-paper';
  tag(root,'h3','按教材学习');
  const nav = tag(root,'div');
  nav.className = 'textbook-controls';
  function choose(label) {
    const el = tag(nav,'label',label);
    return tag(el,'select');
  }
  const bookSelect = choose('教材');
  const chapterSelect = choose('章节');
  const content = tag(root,'div');
  for (const book of books) bookSelect.add(new Option(book.title,book.id));
  bookSelect.value = state.book;
  function render() {
    const book = books.find(item => item.id === bookSelect.value);
    state.book = book.id;
    const chapter = book.chapters.find(item => item.number === state.chapter) ?? book.chapters[0];
    state.chapter = chapter.number;
    chapterSelect.replaceChildren();
    for (const item of book.chapters) chapterSelect.add(new Option(item.number+' · '+item.title,item.number));
    chapterSelect.value = chapter.number;
    content.replaceChildren();
    const filePanel = tag(content,'details');
    filePanel.className = 'textbook-file';
    tag(filePanel,'summary',localCopies.has(book.id)?'本机教材已连接':'连接本机 PDF，跳转原书页码');
    const fileLabel = tag(filePanel,'label','选择这一本教材的 PDF ');
    const input = tag(fileLabel,'input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    const status = tag(filePanel,'p','文件仅在本次打开网站时使用。页码从 PDF 封面起算。');
    status.setAttribute('role','status');
    const links = [];
    function pageLink(parent,label,page) {
      const a = tag(parent,'a',label+' · PDF '+page);
      a.target='_blank'; a.rel='noopener noreferrer';
      // Without a local copy, the same link leads to the file chooser.
      a.href='#';
      a.onclick = event => {
        if (localCopies.has(book.id)) return;
        event.preventDefault();
        filePanel.open=true;
        input.focus();
        input.click();
      };
      links.push([a,page]);
      if (localCopies.has(book.id)) a.href=localCopies.get(book.id)+'#page='+page;
    }
    input.onchange = async () => {
      const file=input.files[0];
      if (!file) return;
      input.disabled=true;
      try {
        const bytes=await file.arrayBuffer();
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
        if (hash!==book.sha256) {status.textContent='所选 PDF 与本目录使用的版本不同，请重新选择。';return;}
        if (!localCopies.has(book.id)) localCopies.set(book.id,URL.createObjectURL(file));
        for (const [a,page] of links) a.href=localCopies.get(book.id)+'#page='+page;
        status.textContent='版本已核对，可以打开正文和习题原页。';
        filePanel.querySelector('summary').textContent='本机教材已连接';
      } catch { status.textContent='读取失败，请重新选择可读取的 PDF。'; }
      finally {input.disabled=false;input.value='';}
    };
    const directory=tag(content,'div');
    directory.className='textbook-sections';
    for (const section of chapter.sections) {
      const row=tag(directory,'details');
      row.open=section.number===state.section;
      const heading=tag(row,'summary');
      tag(heading,'small',section.number);
      appendInlineContent(heading,section.title);
      const body=tag(row,'div');
      appendInlineContent(tag(body,'p'),section.guide);
      if(section.topics) appendInlineContent(tag(body,'p'),section.topics);
      const sources=tag(body,'div');
      sources.className='textbook-sources';
      pageLink(sources,'正文',section.page);
      if (section.exercisePage) pageLink(sources,'原书习题 '+section.number,section.exercisePage);
      if (section.references) {
        const refs=tag(body,'details');
        tag(refs,'summary','定义、命题与例题的原书编号');
        const list=tag(refs,'div');list.className='textbook-sources';
        for(const [label,page] of Object.entries(section.references)) pageLink(list,label,page);
      }
      if (section.exercises) {
        const exercises=tag(body,'details');
        tag(exercises,'summary','原书习题（'+Object.keys(section.exercises).length+'）');
        const list=tag(exercises,'div');
        list.className='textbook-sources';
        for (const [n,page] of Object.entries(section.exercises)) pageLink(list,'题 '+section.number.split('.')[1]+'.'+n,page);
      }
    }
    if (chapter.reviewPage) pageLink(content,'本章总练习',chapter.reviewPage);
    if (chapter.practice) {
      const practice=tag(content,'section');
      practice.className='textbook-practice';
      tag(practice,'h4','本章自测');
      appendInlineContent(tag(practice,'p'),chapter.practice[0]);
      const solution=tag(practice,'details');
      tag(solution,'summary','核对解法');
      appendInlineContent(tag(solution,'p'),chapter.practice[1]);
      if (chapter.plot) {
        const plot=tag(practice,'details');
        tag(plot,'summary','用函数图检验');
        plot.addEventListener('toggle',()=>{
          if (!plot.open || plot.querySelector('figure')) return;
          const figure=tag(plot,'figure');
          figure.className='document-plot';
          mountInlinePlot(figure,chapter.plot[0],chapter.plot[1]);
        });
      }
    }
    if(book.back.length) {
      const back=tag(content,'details');
      tag(back,'summary','附录与参考页');
      const list=tag(back,'div');list.className='textbook-sources';
      for(const [label,page] of book.back) pageLink(list,label,page);
    }
  }
  bookSelect.onchange=()=>{state.chapter=null;state.section=null;render();};
  chapterSelect.onchange=()=>{state.chapter=chapterSelect.value;state.section=null;render();};
  render();
}
