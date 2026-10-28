import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const checks=[];
try{
 await page.goto('http://127.0.0.1:3700',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.stage-card').first().waitFor();
 checks.push(['initialGraph',await page.locator('.stage-card').count()===6]);
 await page.locator('.stage-card').first().click();
 checks.push(['detailOpens',await page.locator('.detail-panel h2').innerText()==='판결로 승소']);
 await page.screenshot({path:'ui-detail.png'});
 await page.locator('.theme-button').click();
 checks.push(['darkMode',await page.locator('.app-shell').getAttribute('data-theme')==='dark']);
 await page.screenshot({path:'ui-dark.png'});
 await page.getByRole('button',{name:'새 사건',exact:true}).click();
 checks.push(['newCaseEmpty',await page.locator('.map-empty').count()===1]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.map-empty').waitFor();
 await page.waitForTimeout(600);
 checks.push(['casePersists',(await page.locator('.case-switch-name').innerText()).includes('새 법률 상담')]);
 checks.push(['themePersists',await page.locator('.app-shell').getAttribute('data-theme')==='dark']);
 console.log(JSON.stringify(checks));
}catch(e){console.log('E2E_ERROR',e.message);console.log(JSON.stringify(checks));process.exitCode=1}
finally{await browser.close()}
