import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/web/math-site.css',import.meta.url),'utf8');
const controller=readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8');

test('mathematics archive offers primary navigation without removing legacy workspace hooks',()=>{
  for(const section of ['home','sessions','courses','library','search','import'])
    assert.match(html,new RegExp(`data-math-nav="${section}"`));
  for(const id of ['navigator','breadcrumbs','globalSearch','moreBtn','learningStartForm','studySessionsHome','studyCatalogList','studyWorkbench'])
    assert.ok(html.includes(`id="${id}"`),`missing workspace hook: ${id}`);
  assert.match(controller,/navigateMathSection\(section\)/);
  assert.match(controller,/updateMathSiteChrome\(\)/);
});

test('guided uniform-convergence entrance connects to the real study workbench',()=>{
  assert.match(html,/data-math-action="example"/);
  assert.match(controller,/为什么一致收敛要求统一的 N？/);
  assert.match(controller,/this\.startLearning\(\)/);
  assert.match(controller,/this\.studyWorkbench\.start\(title,mode,chapterId\)/);
  assert.match(html,/id="studySessionsExport"/);
  assert.match(html,/id="studySessionsImport"/);
});

test('archive design supports desktop, mobile, dark theme and focused learning',()=>{
  assert.match(html,/href="math-site\.css"/);
  assert.match(css,/data-view="home"/);
  assert.match(css,/data-view="study"/);
  assert.match(css,/@media \(max-width:780px\)/);
  assert.match(css,/@media \(max-width:540px\)/);
  assert.match(css,/html\[data-theme="dark"\]/);
  const sharedCss=readFileSync(new URL('../packages/ui/design-system.css',import.meta.url),'utf8');
  assert.match(sharedCss,/:focus-visible/);
});
