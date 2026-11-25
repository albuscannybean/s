import assert from 'node:assert/strict';

export async function checkSemester(page){
  const nav=page.locator('.math-main-nav'),home=nav.locator('[data-math-nav="home"]');
  const courses=[
    ['course-algebra','ALG'],['course-ode','ODE'],
    ['course-probability','PROB'],['course-analysis-3','AN3']
  ];
  for(const [course,prefix] of courses){
    await home.click();
    await page.locator('#semesterHome [data-path-id="'+course+'"]').click();
    const chapter=page.locator('.math-chapter-card');
    assert.equal(await chapter.locator('[data-archive-kind="knowledge"]').count(),2);
    assert.equal(await chapter.locator('[data-archive-kind="problem"]').count(),2);
    await chapter.locator('[data-id="'+prefix+'-K01"]').click();
    assert.match(await page.locator('#mathReadingBody').innerText(),/先算一个例子/);
    assert.equal(await page.locator('#mathPrivateNote').evaluate(e=>getComputedStyle(e).resize),'none');
    if(prefix==='PROB'){
      await page.locator('#collectionControl summary').click();
      await page.locator('[name="newFolder"]').fill('本学期复习');
      await page.getByRole('button',{name:'保存到收藏夹',exact:true}).click();
      assert.match(await page.locator('#collectionStatus').innerText(),/本学期复习/);
      await page.reload();await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
      await nav.locator('[data-math-nav="knowledge"]').click();
      await page.locator('[data-catalog-filter="folder"]').selectOption('本学期复习');
      assert.equal(await page.locator('#mathArchiveResults .catalog-row').count(),1);
      await page.locator('#mathArchiveResults [data-id="PROB-K01"]').click();
    }
    await page.locator('#mathArchive [data-path-action="method"]').click();
    assert.ok(await page.locator('#mathMethodReason').isVisible());
    await page.locator('#mathArchive [data-path-action="problem"]').click();
    assert.ok(page.url().endsWith(prefix+'-P01'));
    await page.locator('[data-math-archive-action="start"]').click();
    assert.ok(await page.locator('#studyQuestion').isVisible());
    if(prefix==='PROB'){
      await page.locator('#studyDraft').fill('至少一次正面留下三个有序结果，第一次正面留下两个。');
      await page.locator('[data-study-action="submit"]').click();
      await page.locator('[data-study-action="finish"]').click();
      assert.match(await page.locator('.study-finish-panel').innerText(),/下次复习/);
    }
  }
  await nav.locator('[data-math-nav="problems"]').click();
  await page.locator('#mathSearch').fill('ODE-P02');
  assert.equal(await page.locator('#mathArchiveResults .catalog-row').count(),1);
  assert.match(await page.locator('#mathArchiveResults').innerText(),/积分因子/);
  await nav.locator('[data-platform-module="applied"]').click();
  assert.ok(await page.locator('#appliedDirectory').isVisible());
  assert.equal(await page.locator('#pathApplication').isVisible(),false);
  assert.equal(await page.locator('#appliedDirectory [data-template] svg').count(),4);
  await page.locator('#mathToolboxToggle').click();
  assert.equal(await page.locator('#mathToolboxPanel button svg').count(),9);
  await page.keyboard.press('Escape');
  const tabs=await page.locator('.document-bar').boundingBox();
  const add=await page.locator('#documentAddSlot button').boundingBox();
  assert.equal(add.width,add.height);
  assert.ok(add.y>=tabs.y&&add.y+add.height<=tabs.y+tabs.height);
  assert.equal(await page.locator('#documentAddSlot button').evaluate(e=>getComputedStyle(e).borderRadius),'50%');
  await page.locator('#documentAddSlot button').click();
  assert.ok(await page.locator('#newTabPage').isVisible());
}

