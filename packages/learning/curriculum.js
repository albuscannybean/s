import {TEXTBOOK_CHAPTERS} from './textbook-lessons.js';
import {LEGACY_SECTION} from './curriculum-links.js';

const layout = {
  algebra:{course:'course-algebra',prefix:'ALG'},
  ode:{course:'course-ode',prefix:'ODE'},
  prob:{course:'course-probability',prefix:'PROB'},
  a1:{course:'course-analysis-1',prefix:'AN1'},
  a2:{course:'course-analysis-2',prefix:'AN2'},
  a3:{course:'course-analysis-3',prefix:'AN3'}
};

const connections = [
  ['a1:2.7','analysis:12.1'], ['a1:2.8','analysis:12.3'],
  ['a1:2.9','analysis:14.1'], ['a1:5.1','analysis:13.1'],
  ['a1:5.2','analysis:13.2'], ['a1:5.3','analysis:14.2'],
  ['analysis:15.1','a2:6.7'], ['analysis:19.3','a2:6.9'],
  ['analysis:17.1','a2:7.2','analysis:23.2'],
  ['analysis:17.2','a2:7.3'], ['analysis:17.4','a2:7.5'],
  ['analysis:18.1','analysis:18.2','a2:7.7','a2:7.8','analysis:23.3'],
  ['analysis:18.3','a2:7.10'], ['analysis:20.1','a2:8.1'],
  ['analysis:20.2','a2:8.4'], ['analysis:21.1','a3:10.6'],
  ['analysis:21.4','a3:10.8'], ['analysis:22.3','a3:12.3'],
  ['analysis:22.4','a3:11.6'], ['a2:7.9','a3:11.1'],
  ['a1:1.7','algebra:1.1','algebra:1.4'],
  ['a1:1.8','algebra:2.1','algebra:2.8'],
  ['prob:3.3','a3:10.7'], ['ode:B.1','a2:7.3']
];

const pad = value => String(value).padStart(2,'0');
const chapterIdFor = ({book,number}) => 'course-'+book+'-'+number.toLowerCase();
const sectionKey = (book,section) => book+':'+section.number;

const proposition = /定理|准则|判别|性质|收敛性|减弱|稳定性/;
const procedure = /计算|估计|变换|解法|拟合|作图|方法|求解|展开|检验/;
function classify(title) {
  const form=proposition.test(title)?'proposition':procedure.test(title)?'procedure':'concept';
  const facets=['object'];
  if(/极限|收敛|完备|连续|紧致/.test(title))facets.push('property');
  if(/群|域|模|环|线性|空间|形式/.test(title))facets.push('structure');
  if(/积分|微分|级数|矩|换元|变换/.test(title))facets.push('operation');
  if(/概率|随机|统计|似然|抽样|估计|检验|回归/.test(title))facets.push('quantity');
  return {form,facets};
}

export function buildCurriculum(existingCourses,existingKnowledge,existingProblems,existingMethods){
  const courses=existingCourses.map(course=>({...course,chapters:[]}));
  courses.push({id:'course-analysis-1',title:'数学分析（一）',icon:'axes',semester:false,chapters:[]});
  const courseById=new Map(courses.map(course=>[course.id,course]));
  const sectionUnits=new Map();
  const baseBySection=new Map();
  for(const unit of existingKnowledge){
    const key=LEGACY_SECTION[unit.id];
    if(!key)throw Error('Missing curriculum placement '+unit.id);
    if(!baseBySection.has(key))baseBySection.set(key,[]);
    baseBySection.get(key).push(unit);
  }

  // The domestic analysis text introduces multivariable analysis in the third course.
  // The Amann volumes retain their own sequence within the three course syllabi.
  const primary=['algebra','ode','prob','a1','analysis','a2','a3'];
  const chapters=primary.flatMap(book=>TEXTBOOK_CHAPTERS.filter(chapter=>chapter.book===book));
  const knowledge=[],problems=[],claimedProblems=new Map(),reviewGroups=new Map();
  for(const sourceChapter of chapters){
    const {book,number,title,sections}=sourceChapter;
    const {course:courseId,prefix}=layout[book]??(Number(number)<16?layout.a2:layout.a3);
    const course=courseById.get(courseId);
    const chapterNumber=course.chapters.length+1;
    const chapter={
      id:chapterIdFor(sourceChapter),number:chapterNumber,title,source:sourceChapter.source,
      sourceNumber:number,knowledgeIds:[],problemIds:[],groups:[]
    };
    course.chapters.push(chapter);
    for(const [index,section] of sections.entries()){
      const key=sectionKey(book,section);
      const legacy=baseBySection.get(key)??[];
      const primaryUnit=legacy[0];
      const id=primaryUnit?.id??('MATH-'+book.toUpperCase()+'-K'+section.number.replace('.','-'));
      const code=prefix+'-'+pad(chapterNumber)+'.'+pad(index+1);
      const source={book:sourceChapter.source,section:section.number,page:section.page};
      const [prompt,solution]=section.practice;
      const body=[
        '::: definition',section.lesson,':::',
        ...(section.topics?['### 本节概念',section.topics]:[]),
        '### 推导与检验',section.guide,
        ...(primaryUnit?['### 延伸阅读',primaryUnit.body]:[])
      ].join('\n\n');
      const unit={
        ...primaryUnit,id,code,title:section.title,kind:'概念与定理',summary:section.guide,
        classification:classify(section.title),body,courseId,chapterId:chapter.id,
        prerequisites:primaryUnit?.prerequisites??[],tags:[course.title,title,...(primaryUnit?[primaryUnit.title,...primaryUnit.tags]:[])],
        source,relatedIds:legacy.slice(1).map(item=>item.id)
      };
      sectionUnits.set(key,unit);
      knowledge.push(unit);
      const group={id,knowledgeIds:[id],problemIds:[]};
      chapter.groups.push(group);
      for(const [extraIndex,item] of legacy.slice(1).entries()){
        knowledge.push({...item,code:code+'-'+pad(extraIndex+2),courseId,chapterId:chapter.id,source,relatedIds:[id]});
        group.knowledgeIds.push(item.id);
      }
      chapter.knowledgeIds.push(...group.knowledgeIds);
      const exercise={
        id:'MATH-'+book.toUpperCase()+'-P'+section.number.replace('.','-'),
        code:code+'-P01',title:section.title+' · 练习',type:'教材配套练习',difficulty:1,
        prompt,solution,hints:[section.guide],transfer:'改变题目中的一个条件，再判断原解法的哪一步需要调整。',
        knowledgeIds:[id],methodIds:[],courseId,chapterId:chapter.id,
        source:{kind:'original',license:'original',attribution:'按教材章节编写',...source}
      };
      if(sourceChapter.plot && (key==='ode:2.1'||key==='ode:4.2'||key==='analysis:14.1')){
        const [expression,caption]=sourceChapter.plot;
        unit.body+='\n\n### 函数图\n\n$'+caption+'$\n\n'+['\x60\x60\x60plot',expression,'\x60\x60\x60'].join('\n');
      }
      problems.push(exercise);
      group.problemIds.push(exercise.id);
      chapter.problemIds.push(exercise.id);
      for(const [drillIndex,drill] of (section.drills??[]).entries()){
        const reviewed={
          ...exercise,id:exercise.id+'-'+pad(drillIndex+2),code:code+'-P'+pad(drillIndex+2),
          title:drill.title,prompt:drill.prompt,solution:drill.solution,difficulty:2,type:'原书习题',
          source:{kind:'adapted',book:source.book,section:source.section,page:drill.page,number:drill.number,attribution:'根据原题转述'}
        };
        problems.push(reviewed);
        group.problemIds.push(reviewed.id);
        chapter.problemIds.push(reviewed.id);
      }
      for(const oldId of group.knowledgeIds)reviewGroups.set(oldId,{unit,chapter,group});
    }
  }
  for(const keys of connections){
    const related=keys.map(key=>sectionUnits.get(key));
    for(const unit of related)unit.relatedIds.push(...related.filter(item=>item!==unit).map(item=>item.id));
  }
  for(const problem of existingProblems){
    const placement=problem.knowledgeIds.map(id=>reviewGroups.get(id)).find(Boolean);
    if(!placement)throw Error('Missing exercise placement '+problem.id);
    const {unit,chapter,group}=placement;
    const code=unit.code+'-P'+pad(group.problemIds.length+1);
    const assigned={...problem,code,courseId:unit.courseId,chapterId:chapter.id};
    problems.push(assigned);
    chapter.problemIds.push(assigned.id);
    group.problemIds.push(assigned.id);
    claimedProblems.set(assigned.id,assigned);
  }
  // Preserve existing exercise order for references and persisted method/knowledge IDs.
  problems.sort((a,b)=>Number(claimedProblems.has(b.id))-Number(claimedProblems.has(a.id)));
  const methodCounts=new Map();
  const methods=existingMethods.map(item=>{
    const unit=item.knowledgeIds.map(id=>reviewGroups.get(id)?.unit).find(Boolean);
    if(!unit)return item;
    const count=(methodCounts.get(unit.id)??0)+1;
    methodCounts.set(unit.id,count);
    return {...item,code:unit.code+'-M'+pad(count),courseId:unit.courseId,chapterId:unit.chapterId};
  });
  return {courses,knowledge,problems,methods};
}
