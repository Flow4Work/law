const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
// Browser QA is performed in Codex's built-in browser, never by launching Chrome.
const files=fs.readdirSync(__dirname).filter(name=>/\.test\.(cjs|mjs)$/.test(name))
 .filter(name=>!/(?:playwright|puppeteer|chromium|launch\()/.test(fs.readFileSync(path.join(__dirname,name),'utf8')))
 .map(name=>path.join(__dirname,name));
const result=spawnSync(process.execPath,['--require',path.join(__dirname,'resolve-typescript.cjs'),'--test',...files],{stdio:'inherit'});
process.exitCode=result.status??1;
