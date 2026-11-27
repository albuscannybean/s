import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {TEXTBOOK_EDITIONS} from '../packages/learning/textbook-editions.js';
import {MATH_COURSES,mathKnowledgeById} from '../packages/learning/math-content.js';

const root=new URL('../apps/web/course-text/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const editions=new Map(TEXTBOOK_EDITIONS.map(item=>[item.id,item]));
const published=new Map();
const expected=new Set(['manifest.json',...manifest.editions.map(id=>id+(manifest.encoding==='gzip'?'.json.gz':'.json'))]);

for(const name of await readdir(root)){
  if(!expected.has(name))throw new Error('教材目录包含发布清单之外的文件：'+name);
}
for(const id of manifest.editions){
  const edition=editions.get(id);
  if(!edition||manifest.publication?.editions?.[id]!==edition.sha256
    ||manifest.publication?.authority!=='repository-owner-confirmed'||published.has(id))
    throw new Error('教材缺少与版本一致的公开授权：'+id);
  const file=await readFile(new URL(id+(manifest.encoding==='gzip'?'.json.gz':'.json'),root));
  const source=JSON.parse(manifest.encoding==='gzip'?gunzipSync(file):file);
  if(source.edition!==edition.sha256||source.format!==manifest.format)throw new Error('教材版本不匹配：'+id);
  const sectionIndex=new Set(edition.chapters.flatMap(chapter=>chapter.sections.map(item=>item.number)));
  for(const [section,record] of Object.entries(source.sections)){
    if(!sectionIndex.has(section)||!Array.isArray(record.pages)||!record.pages.length)
      throw new Error('教材小节未定位：'+id+' '+section);
    for(const [page,blocks] of record.pages){
      if(!Number.isInteger(page)||page<1||page>edition.pages||!Array.isArray(blocks)||!blocks.length)
        throw new Error('教材页码或正文缺失：'+id+' '+section);
    }
  }
  published.set(id,source.sections);
}
for(const course of MATH_COURSES)for(const chapter of course.chapters)for(const group of chapter.groups){
  const unit=mathKnowledgeById(group.id),edition=TEXTBOOK_EDITIONS.find(item=>item.title===unit.source?.book);
  const record=published.get(edition?.id)?.[unit.source?.section];
  if(published.has(edition?.id)&&!record?.pages.some(([page])=>page===unit.source.page))
    throw new Error('课程小节和教材页码不一致：'+unit.id);
}
console.log('Verified '+published.size+' authorized editions, section keys and source page ranges.');

