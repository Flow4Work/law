const{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const p=await b.newPage({viewport:{width:1400,height:900}});
await p.addInitScript(()=>{
  const nativeFocus=HTMLElement.prototype.focus;
  HTMLElement.prototype.focus=function(...args){if(location.port==='3200'||location.port==='3700')console.log('DEBUG_FOCUS',location.port,this.tagName,this.className?.toString().slice(0,50),JSON.stringify(args).slice(0,70));return nativeFocus.apply(this,args)};
  const nativeScroll=window.scrollTo;
  window.scrollTo=function(...args){console.log('DEBUG_SCROLL_TO',location.port,JSON.stringify(args).slice(0,100));return nativeScroll.apply(this,args)};
});
p.on('console',m=>{if(m.text().startsWith('DEBUG'))console.log(m.text())});
await p.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1000);
console.log('BEFORE',await p.evaluate(()=>scrollY));
await p.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.documentElement.style.overflowAnchor='none';document.body.style.overflowAnchor='none';const e=document.querySelector('[data-law-playback="step4"] .law-showcase-viewport');scrollTo(0,scrollY+e.getBoundingClientRect().top-140)});
for(let i=0;i<4;i++){await p.waitForTimeout(2200);console.log('Y',await p.evaluate(()=>scrollY))}
await b.close()})().catch(e=>console.error(e));