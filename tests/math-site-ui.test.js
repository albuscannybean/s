import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/web/math-site.css',import.meta.url),'utf8');
const controller=readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8');

test('mathematics archive offers content-first navigation without removing legacy workspace hooks',()=>{
  for(const section of ['sessions','courses','problems','knowledge','methods','about'])
    assert.match(html,new RegExp(`data-math-nav="${section}"`));
  for(const id of ['navigator','breadcrumbs','globalSearch','moreBtn','learningStartForm','studySessionsHome','studyCatalogList','studyWorkbench'])
    assert.ok(html.includes(`id="${id}"`),`missing workspace hook: ${id}`);
  for(const id of ['mathArchive','mathToolbox','mathToolboxPanel','mathFeaturedProblems'])assert.ok(html.includes(`id="${id}"`));
  assert.match(controller,/navigateMathSection\(section\)/);
  assert.match(controller,/updateMathSiteChrome\(\)/);
});

test('real problem entrance connects to the study archive and workbench',()=>{
  assert.match(html,/data-math-nav="discovery"/);
  assert.match(controller,/this\.openMathArchive\('problem','ANA-UC-P02'\)/);
  assert.match(controller,/this\.openMathArchive\('problem'/);
  assert.match(controller,/this\.studyWorkbench\.start\(title,mode,chapterId\)/);
  assert.match(html,/id="studySessionsExport"/);
  assert.match(html,/id="studySessionsImport"/);
});

test('archive design supports desktop, mobile, dark theme and focused learning',()=>{
  assert.match(html,/href="math-site\.css"/);
  assert.match(css,/data-view="home"/);
  assert.match(css,/data-view="study"/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/var\(--paper\)/);
  const sharedCss=readFileSync(new URL('../packages/ui/design-system.css',import.meta.url),'utf8');
  assert.match(sharedCss,/:focus-visible/);
});


test('problem-first launch links to all four semester courses',()=>{
  assert.match(html,/id="learningLaunchTitle"/);
  for(const id of ['ALG-P02','ODE-P01','PROB-P01','AN3-P01'])assert.ok(html.includes('data-path-action="problem" data-path-id="'+id+'"'));
  assert.match(css,/\.learning-challenges/);
});


test('primary navigation exposes five direct modules without a homepage',()=>{
  const nav=html.match(/<nav class="math-main-nav"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<button /g)||[]).length,5);assert.doesNotMatch(nav,/data-math-nav="home"/);
});
