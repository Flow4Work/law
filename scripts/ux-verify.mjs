import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const [name,width,height] of [['wide',1680,900],['desktop',1440,900],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:3700',{waitUntil:'networkidle',timeout:30000});
 await page.locator('.stage-card').first().waitFor();
 await page.screenshot({path:'ux-'+name+'.png',fullPage:true});
 const data=await page.evaluate(()=>({window:[innerWidth,innerHeight],rootFont:getComputedStyle(document.querySelector('.app-shell')).fontSize,stageTitle:getComputedStyle(document.querySelector('.stage-title')).fontSize,stageDescription:getComputedStyle(document.querySelector('.stage-description')).fontSize,graph:document.querySelector('.graph-wrapper').getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.stage-card')].map(x=>({title:x.querySelector('.stage-title')?.textContent,rect:x.getBoundingClientRect().toJSON()}))}));
 console.log(name,JSON.stringify(data));
 await page.close();
}
await browser.close();
