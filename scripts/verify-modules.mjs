import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Keep feature modules independent: only the workspace controller coordinates them.
const read=(file)=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
const pageSource=read('app/page.tsx');
const conversation=read('features/conversation/conversation-panel.tsx');
const map=read('features/map/map-workspace.tsx');
const details=read('features/methods/method-detail-panel.tsx');
const controller=read('features/workspace/use-legal-workspace.ts');
assert.ok(pageSource.includes('useLegalWorkspace()'));
assert.ok(pageSource.includes('<ConversationPanel'));
assert.ok(pageSource.includes('<MapWorkspace'));
assert.ok(pageSource.includes('<DetailPanel'));
assert.ok(!pageSource.includes("fetch('/api/"));
assert.ok(!conversation.includes('/features/map/')&&!conversation.includes('/features/methods/'));
assert.ok(!map.includes('/features/conversation/')&&!map.includes('/features/methods/'));
assert.ok(!details.includes('/features/map/')&&!details.includes('/features/conversation/'));
assert.ok(controller.includes("fetch('/api/analyze'"));
console.log('PASS: feature boundaries and workspace orchestration');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:{width:mobile?390:1440,height:mobile?844:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.app-shell').waitFor();
  await page.locator('.conversation-panel').waitFor();
  assert.equal(await page.locator('.visual-panel').count(),1);
  assert.equal(await page.locator('.composer').count(),1);
  // Wait for saved-case hydration on both viewports before switching to the example.
  await page.waitForTimeout(500);
  if(mobile){
   await page.evaluate(()=>document.querySelector('.conversation-tabs [role="tab"]')?.click());
   await page.locator('.mobile-navigation button').nth(1).click();
   await page.locator('.app-shell.mobile-map').waitFor({timeout:15000});
   await page.locator('.mobile-journey').waitFor({timeout:15000});
   await page.locator('.journey-origin').click();
  } else {
   await page.getByRole('tab',{name:'예시',exact:true}).click();
   await page.locator('.stage-card').first().waitFor({timeout:15000});
   await page.locator('.stage-card').first().click();
  }
  await page.locator('.detail-panel').waitFor({timeout:15000});
  assert.ok((await page.locator('.detail-panel h2').first().textContent())?.trim());
  await page.getByRole('button',{name:'설명 닫기'}).click();
  assert.equal(await page.locator('.detail-panel').count(),0);
  if(!mobile){
   await page.getByRole('button',{name:'대화 기록'}).click();
   await page.locator('.history-list').waitFor();
   await page.locator('.history-entry-open').first().click();
   await page.locator('.composer').waitFor();
  }
  assert.deepEqual(errors,[],mobile?'Mobile browser errors':'Desktop browser errors');
  console.log('PASS: '+(mobile?'mobile':'desktop')+' conversation / map / detail interaction');
  await page.close();
 }
} finally { await browser.close(); }
