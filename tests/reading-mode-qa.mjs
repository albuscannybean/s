import assert from 'node:assert/strict';

export async function checkReadingMode(page) {
  const firstCourse=page.locator('.math-main-nav [data-math-nav=courses]');
  await firstCourse.click();
  await page.locator('[data-archive-kind=course][data-id=course-analysis-1]').click();
  const firstReading=page.locator('[data-course-reading=MATH-A1-K1-1]');
  assert.ok((await firstReading.locator('.math-reading-body').first().innerText()).length>250);
  const bar=await page.locator('.document-bar').boundingBox();
  const masthead=await page.locator('.math-brand').boundingBox();
  assert.ok(Math.abs(bar.x-masthead.x)<2);
  assert.ok(Math.abs(bar.width+2*bar.x-1440)<3);
  await firstReading.getByText('随堂练习',{exact:true}).click();
  assert.ok(await firstReading.getByText('作答与核对',{exact:true}).isVisible());
  await page.locator('[data-archive-kind=knowledge][data-id=MATH-A1-K1-1]').click();
  let passage=page.locator('#mathReadingBody .reading-paragraph').first();
  await passage.locator('button.reading-paragraph-note').focus();
  await passage.locator('button.reading-paragraph-note').click();
  const note=passage.getByRole('textbox',{name:'段落批注'});
  await note.fill(String.raw`逆否命题是 \(\neg Q\Rightarrow\neg P\)。`);
  await passage.getByRole('button',{name:'分屏',exact:true}).click();
  assert.ok(await passage.locator('.reading-preview .katex').count()>0);
  await page.waitForFunction(()=>lmnWorkspace.mathArchive.timers.size===0);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.lmnWorkspace);
  passage=page.locator('#mathReadingBody .reading-paragraph').first();
  assert.equal(await passage.locator('button.reading-paragraph-note').innerText(),'批注');
  await passage.locator('button.reading-paragraph-note').click();
  assert.ok(await passage.locator('.reading-preview .katex').isVisible());

  const source=page.locator('.reading-source-panel');
  await source.locator(':scope > summary').click();
  const prose=source.getByRole('textbox',{name:'讲解源码'});
  const before=await prose.inputValue();
  await prose.fill(before+'\n\n\\[\n\\frac12+\\frac12=1\n\\]');
  assert.ok(await page.locator('#mathReadingBody .math-display-katex .katex').count()>0);
  await source.locator('input[type=file]').setInputFiles({
    name:'private-source.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'lmn-course-source/1',sections:[{
      id:'MATH-A1-K1-1',text:'从条件推出结论也可以使用逆否命题。'
    }]}))
  });
  await source.getByText('已连接 1 节原文。',{exact:true}).waitFor();
  assert.ok(await source.getByText('从条件推出结论也可以使用逆否命题。',{exact:true}).isVisible());
  await source.locator(':scope > summary').click();

  const myNote=page.locator('#mathPrivateNote');
  await myNote.fill(String.raw`$x^2+y^2=1$`);
  await page.getByRole('button',{name:'笔记工具箱'}).click();
  const side=page.locator('.math-private-annotation');
  await side.getByRole('button',{name:'函数图',exact:true}).click();
  await side.getByRole('button',{name:'分屏',exact:true}).click();
  const plot=side.locator('.document-plot-viewport').first();
  await plot.locator('.coordinate-curve').first().waitFor({state:'attached'});
  assert.ok(await plot.evaluate(el=>el.clientWidth>0&&el.clientHeight>0));
  await plot.scrollIntoViewIfNeeded();
  const location=await plot.boundingBox();
  const transform=()=>plot.locator('.scene-root').evaluate(el=>el.style.transform);
  const start=await transform();
  await page.mouse.move(location.x+location.width/2,location.y+location.height/2);
  await page.mouse.down();
  await page.mouse.move(location.x+location.width/2+24,location.y+location.height/2+18,{steps:4});
  await page.mouse.up();
  await page.waitForFunction(initial=>document.querySelector('.math-private-annotation .scene-root').style.transform!==initial,start);
  const dragged=await transform();
  await side.getByRole('button',{name:'放大',exact:true}).click();
  await page.waitForFunction(initial=>document.querySelector('.math-private-annotation .scene-root').style.transform!==initial,dragged);
  await page.getByRole('button',{name:'笔记工具箱'}).click();
  await side.getByRole('button',{name:'矩阵结构',exact:true}).click();
  await side.locator('.document-plot').nth(1).locator('.scene-node').first().waitFor({state:'attached'});
  assert.match(await myNote.inputValue(),/builtin:matrix-grid/);
}
