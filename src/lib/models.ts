import 'server-only';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import type {ModelChoice,ModelInventory} from './model-types';
import {isAllowedBaiModel,listProviderModels,visibleProviderModels} from './model-catalog';
import {readVisitorModels,writeVisitorModels} from './visitor-model-session';

export type ProviderConfig=ModelChoice&{baseUrl:string;key:string};
type SavedConnection={id:string;name:string;provider:string;model:string;baseUrl:string;encryptedKey:string;effort?:'low'|'high'|'max'};
const dataDir=path.join(process.cwd(),'data');
const configFile=path.join(dataDir,'ai-connections.json');
const secretFile=path.join(dataDir,'.ai-secret');
const hiddenFile=path.join(dataDir,'hidden-connections.json');
const hiddenModelsFile=path.join(dataDir,'hidden-models.json');
const overridesFile=path.join(dataDir,'model-overrides.json');
const rootId=(id:string)=>id.replace(/:(?:high|low|flash)$/,'');
export const modelConnectionsHosted=()=>process.env.VERCEL==='1';
function requirePersonalConnection(id:string){if(!rootId(id).startsWith('visitor:'))throw new Error('공용 연결은 변경할 수 없어요. 내 API 키로 새 연결을 추가해주세요.')}
async function hiddenConnections():Promise<string[]>{try{const data=JSON.parse(await readFile(hiddenFile,'utf8'));return Array.isArray(data)?data.filter((id:unknown):id is string=>typeof id==='string'):[]}catch{return []}}
async function hiddenModels():Promise<string[]>{try{const data=JSON.parse(await readFile(hiddenModelsFile,'utf8'));return Array.isArray(data)?data.filter((id:unknown):id is string=>typeof id==='string'):[]}catch{return []}}
const workspace=()=>process.env.LEGAL_MODEL_WORKSPACE||path.join(process.env.USERPROFILE||'C:\\Users\\동호','Projects','ai-product-workspace');
async function loadSaved():Promise<SavedConnection[]>{try{const data=JSON.parse(await readFile(configFile,'utf8'));return Array.isArray(data)?data:[]}catch{return []}}
async function loadOverrides():Promise<Record<string,{model:string;name:string}>>{
 try{const parsed=JSON.parse(await readFile(overridesFile,'utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
  return Object.fromEntries(Object.entries(parsed).filter(([,value])=>!!value&&typeof value==='object'&&typeof (value as {model?:unknown}).model==='string')) as Record<string,{model:string;name:string}>;
 }catch{return {}}
}
function decrypt(value:string,secret:Buffer){const [iv,tag,body]=value.split(':');const d=createDecipheriv('aes-256-gcm',secret,Buffer.from(iv,'hex'));d.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([d.update(Buffer.from(body,'hex')),d.final()]).toString('utf8')}
export function validBaseUrl(value:string){const url=new URL(value);if(url.username||url.password||url.search||url.hash)throw new Error('주소에는 인증 정보나 검색 조건을 넣지 말아주세요.');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('HTTPS 주소나 이 컴퓨터의 로컬 주소를 사용해주세요.');return url.href.replace(/\/+$/,'')}
export function validLocalBaseUrl(value:string){const normalized=validBaseUrl(value);const url=new URL(normalized);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('로컬 서버 주소에는 이 컴퓨터의 주소를 입력해주세요.');return normalized}
function variants(item:{id:string;name:string;provider:string;model:string;baseUrl:string;key:string;source:string;isDefault?:boolean;effort?:'low'|'high'|'max'}):ProviderConfig[]{
 const externalFreeModel=item.provider==='opencode'&&/-free$/i.test(item.model);
 const base={...item,available:(Boolean(item.key)||item.provider==='local')&&!externalFreeModel,...(externalFreeModel?{reason:'OpenCode의 무료 추론 모델은 외부 API 앱에서 사용할 수 없어요. 유료 모델을 선택해주세요.'}:{})};
 if(item.provider==='glm'&&/^glm-5\.3(?:-flash)?$/i.test(item.model))return [
  {...base,id:item.id+':high',name:'GLM 5.3 · High',model:'glm-5.3',effort:'high',isDefault:item.isDefault},
  {...base,id:item.id+':low',name:'GLM 5.3 · Low',model:'glm-5.3',effort:'low',isDefault:false},
  {...base,id:item.id+':flash',name:'GLM 5.3 Flash · Low',model:'glm-5.3-flash',effort:'low',isDefault:false}
 ];
 return [base];
}
let baiCatalogCache:{identity:string;expires:number;task:Promise<ProviderConfig[]>}|undefined;
async function baiEnvironmentModels(refresh=false):Promise<ProviderConfig[]>{
 const key=process.env.BAI_API_KEY||process.env.b_ai||process.env['b.ai']||process.env.B_AI_API_KEY;
 if(!key)return [];
 const baseUrl=process.env.BAI_BASE_URL||'https://api.b.ai/v1';
 const base={provider:'bai',baseUrl,key,source:'운영자가 등록한 B.AI 연결',available:true};
 // Discover both permitted models even if a legacy BAI_MODEL environment setting exists.
 const identity=createHash('sha256').update(baseUrl+'|'+key).digest('hex');
 if(!refresh&&baiCatalogCache?.identity===identity&&Date.now()<baiCatalogCache.expires)return baiCatalogCache.task;
 const task=listProviderModels('bai',baseUrl,key).then(catalog=>visibleProviderModels('bai',catalog).map(model=>({...base,id:'env:bai:'+encodeURIComponent(model.id),name:'B.AI · '+model.name,model:model.id}))).catch(()=>{
  if(baiCatalogCache?.identity===identity)baiCatalogCache.expires=Date.now()+30000;
  return [{...base,id:'env:bai:unavailable',name:'B.AI · 연결 확인 필요',model:'',available:false,reason:'B.AI 모델 목록을 확인하지 못했어요. 연결 확인으로 다시 시도해주세요.'}];
 });
 baiCatalogCache={identity,expires:Date.now()+300000,task};
 return task;
}
async function configuredModels(refresh=false):Promise<ProviderConfig[]>{
 const configs:ProviderConfig[]=[];
 if(process.env.LEGAL_MODEL_CONNECTIONS){
  try{
   const entries=JSON.parse(process.env.LEGAL_MODEL_CONNECTIONS);
   if(!Array.isArray(entries))throw new Error('Expected a connection list');
   for(const entry of entries){
    if(!entry||typeof entry!=='object'||!['id','name','provider','model','baseUrl','key'].every(field=>typeof entry[field]==='string')||!entry.key||entry.provider==='local')continue;
    const baseUrl=validBaseUrl(entry.baseUrl);
    if(modelConnectionsHosted()&&new URL(baseUrl).protocol!=='https:')continue;
    configs.push(...variants({id:entry.id,name:entry.name,provider:entry.provider,model:entry.model,baseUrl,key:entry.key,source:'운영자가 등록한 연결',isDefault:entry.isDefault===true,effort:['low','high','max'].includes(entry.effort)?entry.effort:undefined}));
   }
  }catch{console.warn('[legal-model-config] LEGAL_MODEL_CONNECTIONS 설정 형식을 확인해주세요.')}
 }
 if(!modelConnectionsHosted()){
 try{
  const raw=JSON.parse(await readFile(path.join(workspace(),'data','workspace.json'),'utf8'));
  const secret=Buffer.from((await readFile(path.join(workspace(),'data','.secret'),'utf8')).trim(),'hex');
  for(const m of raw.models||[]){if(!m.encryptedKey)continue;try{configs.push(...variants({id:'workspace:'+m.id,name:m.name||m.model,provider:m.provider,model:m.model,baseUrl:validBaseUrl(m.baseUrl),key:decrypt(m.encryptedKey,secret),source:'3400번에 저장된 연결',isDefault:Boolean(m.isDefault)}))}catch{}}
 }catch{}
 }
 const envGlm=process.env.GLM_API_KEY||process.env.ZAI_API_KEY;
 if(envGlm&&!configs.some(m=>m.provider==='glm'))configs.push(...variants({id:'env:glm',name:'GLM 5.3',provider:'glm',model:'glm-5.3',baseUrl:process.env.GLM_BASE_URL||'https://api.z.ai/api/paas/v4',key:envGlm,source:'환경 변수',isDefault:true}));
 if(process.env.OPENROUTER_API_KEY)configs.push({id:'env:openrouter',name:'OpenRouter · '+(process.env.OPENROUTER_MODEL||'모델 선택'),provider:'openrouter',model:process.env.OPENROUTER_MODEL||'openrouter/auto',baseUrl:'https://openrouter.ai/api/v1',key:process.env.OPENROUTER_API_KEY,source:'환경 변수',available:true});
 configs.push(...await baiEnvironmentModels(refresh));
 if(!modelConnectionsHosted())try{const secret=Buffer.from((await readFile(secretFile,'utf8')).trim(),'hex');for(const m of await loadSaved())configs.push(...variants({...m,key:m.encryptedKey?decrypt(m.encryptedKey,secret):'',source:'이 서비스에 저장한 연결'}))}catch{}
 return configs;
}
let localCache:{at:number;models:ProviderConfig[]}|undefined;
async function localModels(refresh=false):Promise<ProviderConfig[]>{
 if(modelConnectionsHosted())return [];
 if(!refresh&&localCache&&Date.now()-localCache.at<30000)return localCache.models;
 const targets=[{name:'Ollama',base:'http://127.0.0.1:11434/v1',url:'http://127.0.0.1:11434/api/tags',ollama:true},{name:'LM Studio',base:'http://127.0.0.1:1234/v1',url:'http://127.0.0.1:1234/v1/models',ollama:false}];
 const results=await Promise.all(targets.map(async target=>{try{const response=await fetch(target.url,{signal:AbortSignal.timeout(1500),cache:'no-store'});if(!response.ok)return [];const data=await response.json();const models=target.ollama?data.models:data.data;return (Array.isArray(models)?models:[]).slice(0,50).flatMap((m:any)=>{const model=target.ollama?m.name:m.id;return typeof model==='string'?[{id:'local:'+target.name+':'+model,name:target.name+' · '+model,model,provider:'local',baseUrl:target.base,key:'',source:'실행 중인 로컬 서버',available:true}]:[]})}catch{return []}}));
 const models=results.flat();localCache={at:Date.now(),models};return models;
}
export async function allProviders(refresh=false){
 const session=modelConnectionsHosted()?await readVisitorModels():{connections:[],hiddenModels:[]};
 const [rawConfigured,local,overrides]=await Promise.all([configuredModels(refresh),localModels(refresh),modelConnectionsHosted()?Promise.resolve({} as Record<string,{model:string;name:string}>):loadOverrides()]);
 rawConfigured.push(...session.connections.flatMap(entry=>variants({...entry,source:'이 브라우저의 개인 연결'})));
 const configured=rawConfigured.flatMap((entry,index)=>{
  const root=rootId(entry.id),override=overrides[root];
  if(!override)return [entry];
  if(rawConfigured.findIndex(item=>rootId(item.id)===root)!==index)return [];
  return variants({id:root,name:override.name||override.model,model:override.model,provider:entry.provider,baseUrl:entry.baseUrl,key:entry.key,source:entry.source,isDefault:entry.isDefault});
 });
 const savedLocal=configured.filter(model=>model.provider==='local');
 const reachableSavedLocal=await Promise.all(savedLocal.map(async model=>{
  try{const response=await fetch(model.baseUrl+'/models',{signal:AbortSignal.timeout(1500),cache:'no-store'});const data=await response.json();const available=response.ok&&Array.isArray(data.data)&&data.data.some((entry:any)=>entry.id===model.model);return {...model,available}}
  catch{return {...model,available:false}}
 }));
 const discovered=local.filter(model=>!savedLocal.some(saved=>saved.baseUrl===model.baseUrl&&saved.model===model.model));
 const [hiddenConnectionsList,hiddenModelsList]=modelConnectionsHosted()?[[],session.hiddenModels]:await Promise.all([hiddenConnections(),hiddenModels()]);
 const hidden=new Set(hiddenConnectionsList),hiddenModelIds=new Set(hiddenModelsList);
 return [...configured.filter(model=>model.provider!=='local'),...reachableSavedLocal,...discovered]
  .filter(model=>(model.provider!=='bai'||isAllowedBaiModel(model.model))&&!hidden.has(rootId(model.id))&&!hiddenModelIds.has(model.id));
}
function chooseFast(configs:ProviderConfig[]):ProviderConfig|undefined{
 const available=configs.filter(m=>m.available);
 return available.find(m=>m.provider==='bai'&&m.model==='minimax-m3.1-flash')
  ||available.find(m=>m.provider==='glm'&&/flash/i.test(m.model))
  ||available.find(m=>m.provider==='glm'&&m.effort==='low')
  ||available.find(m=>m.provider==='glm')
  ||available.find(m=>m.provider==='bai'&&m.model==='gpt-6-luna')
  ||available.find(m=>/flash|mini|haiku|turbo|small/i.test(m.model)&&m.effort!=='high')
  ||available.find(m=>m.effort==='low')
  ||available.find(m=>m.isDefault)
  ||available[0];
}
export async function getModelInventory(refresh=false):Promise<ModelInventory>{
 const configs=await allProviders(refresh);
 const models=configs.map(({key,baseUrl,...safe})=>({...safe,editable:!modelConnectionsHosted()||safe.id.startsWith('visitor:')}));
 const defaultId=chooseFast(configs)?.id||'';
 return {models,defaultId,readOnly:false,browserScoped:modelConnectionsHosted(),lawApiConnected:Boolean(process.env.LAW_API_OC),connections:[
  {provider:'glm',name:'GLM / Z.AI',connected:models.some(m=>m.provider==='glm'),message:models.some(m=>m.provider==='glm')?'저장된 API 키를 사용해요.':'API 키를 연결해주세요.'},
  {provider:'openrouter',name:'OpenRouter',connected:models.some(m=>m.provider==='openrouter'),message:models.some(m=>m.provider==='openrouter')?'등록한 모델을 선택할 수 있어요.':'등록된 키가 없어요. 연결하면 모델 목록을 가져와요.'},
  {provider:'bai',name:'B.AI',connected:models.some(m=>m.provider==='bai'),message:models.some(m=>m.provider==='bai')?'등록한 모델을 선택할 수 있어요.':'API 키를 연결해주세요.'},
  {provider:'gemini',name:'Google Gemini',connected:models.some(m=>m.provider==='gemini'),message:models.some(m=>m.provider==='gemini')?'등록한 모델을 선택할 수 있어요.':'Gemini API 키를 연결해주세요.'},
  {provider:'local',name:'Ollama / LM Studio',connected:models.some(m=>m.provider==='local'&&m.available),message:models.some(m=>m.provider==='local'&&m.available)?'로컬 모델이 발견됐어요.':'기본 포트에서 실행 중인 모델 서버가 없어요.'},
  ...models.filter(m=>!['glm','openrouter','bai','gemini','local'].includes(m.provider)).map(m=>({provider:m.provider,name:m.name,connected:m.available,message:m.reason||m.source}))
 ]};
}
export async function findConfiguredProvider(id:string):Promise<ProviderConfig>{const cfg=(await allProviders()).find(model=>model.id===id);if(!cfg)throw new Error('선택한 연결을 찾지 못했어요.');return cfg}
export async function resolveProvider(id?:string):Promise<ProviderConfig>{const configs=await allProviders();const cfg=id?configs.find(m=>m.id===id):chooseFast(configs);if(!cfg||!cfg.available)throw new Error('선택한 모델의 연결을 확인해주세요.');return cfg}
let saveQueue=Promise.resolve();
export async function saveConnection(raw:any){
 if(!raw||typeof raw!=='object')throw new Error('연결 정보를 입력해주세요.');
 const existing=typeof raw.connectionId==='string'&&raw.connectionId?await findConfiguredProvider(raw.connectionId):null;
 if(modelConnectionsHosted()&&existing)requirePersonalConnection(existing.id);
 const provider=existing?.provider||(['glm','openrouter','opencode','gemini','bai','local','custom'].includes(raw.provider)?raw.provider:'custom');
 const key=existing?.key||(typeof raw.key==='string'?raw.key.trim():'');
 if(provider!=='local'&&!key)throw new Error('API 키를 입력해주세요.');
 const baseUrl=existing?.baseUrl||(provider==='openrouter'?'https://openrouter.ai/api/v1':provider==='bai'?'https://api.b.ai/v1':provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai':provider==='opencode'?'https://opencode.ai/inference/openai/v1':provider==='local'?validLocalBaseUrl(String(raw.baseUrl||'')):validBaseUrl(String(raw.baseUrl||'')));
 const requestedModel=String(raw.model||'').trim();if(!requestedModel||requestedModel.length>200)throw new Error('사용할 모델을 선택하거나 모델 ID를 입력해주세요.');
 if(provider==='bai'&&!isAllowedBaiModel(requestedModel))throw new Error('B.AI는 MiniMax M3.1 Flash와 GPT-6 Luna만 사용할 수 있어요.');
 const list=visibleProviderModels(provider,await listProviderModels(provider,baseUrl,key));
 if(!list.some(m=>m.id===requestedModel)&&!(provider==='openrouter'&&requestedModel==='openrouter/auto'))throw new Error('이 연결의 모델 목록에서 해당 모델을 찾지 못했어요. 모델 ID를 확인해주세요.');
 if(modelConnectionsHosted()){
  const session=await readVisitorModels();
  const replacement=typeof raw.replaceId==='string'?rootId(raw.replaceId):'';
  if(replacement){requirePersonalConnection(replacement);if(!session.connections.some(item=>item.id===replacement)||existing&&rootId(existing.id)!==replacement)throw new Error('교체할 개인 연결을 찾지 못했어요.')}
  const id=replacement||'visitor:'+randomUUID();
  const connection={id,name:String(raw.name||requestedModel).slice(0,100),provider,model:requestedModel,baseUrl,key,effort:existing?.effort};
  await writeVisitorModels({...session,connections:[...session.connections.filter(item=>item.id!==id),connection]});
  return id;
 }
 // Imported connections stay in their source app; only this project's preferred model changes.
 if(existing&&!rootId(existing.id).startsWith('saved:')&&!raw.replaceId){
  const root=rootId(existing.id);
  const task=saveQueue.then(async()=>{
   await mkdir(dataDir,{recursive:true});
   const overrides=await loadOverrides();
   overrides[root]={model:requestedModel,name:String(raw.name||requestedModel).slice(0,100)};
   await writeFile(overridesFile,JSON.stringify(overrides,null,2),{mode:0o600});
   return root;
  });
  saveQueue=task.then(()=>undefined,()=>undefined);
  return task;
 }
 const write=async()=>{await mkdir(dataDir,{recursive:true});let secret:Buffer;try{secret=Buffer.from((await readFile(secretFile,'utf8')).trim(),'hex')}catch{const fresh=randomBytes(32);try{await writeFile(secretFile,fresh.toString('hex'),{flag:'wx',mode:0o600});secret=fresh}catch{secret=Buffer.from((await readFile(secretFile,'utf8')).trim(),'hex')}}
  let encryptedKey='';if(key){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',secret,iv);const encrypted=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);encryptedKey=[iv.toString('hex'),cipher.getAuthTag().toString('hex'),encrypted.toString('hex')].join(':')}
  const saved=await loadSaved();
  const replacement=typeof raw.replaceId==='string'?rootId(raw.replaceId):'';
  const target=replacement?saved.find(item=>item.id===replacement):undefined;
  if(replacement&&!target)throw new Error('이 서비스에서 직접 저장한 연결만 교체할 수 있습니다.');
  if(target&&existing&&rootId(existing.id)!==target.id)throw new Error('교체할 연결이 선택한 API와 다릅니다.');
  const id=target?.id||'saved:'+randomUUID();
  const updated={id,name:String(raw.name||requestedModel).slice(0,100),provider,model:requestedModel,baseUrl,encryptedKey:target?.encryptedKey||encryptedKey,effort:['low','high','max'].includes(raw.effort)?raw.effort:undefined};
  if(target)Object.assign(target,updated);else saved.push(updated);
  await writeFile(configFile,JSON.stringify(saved,null,2),{mode:0o600});return id;
 };
 const task=saveQueue.then(write);saveQueue=task.then(()=>undefined,()=>undefined);return task;
}


/** Remove a single model from this app. Deleting an imported variant never mutates its source connection. */
export async function deleteModel(modelId:string){
 if(modelConnectionsHosted()){
  requirePersonalConnection(modelId);
  const model=await findConfiguredProvider(modelId),root=rootId(model.id);
  if(model.id===root)return deleteConnection(root);
  const session=await readVisitorModels();
  await writeVisitorModels({...session,hiddenModels:Array.from(new Set([...session.hiddenModels,modelId]))});
  return;
 }
 if(!modelId||modelId.length>250)throw new Error('삭제할 모델을 선택해주세요.');
 const configured=await allProviders();
 const model=configured.find(item=>item.id===modelId);
 if(!model)throw new Error('이미 삭제했거나 없는 모델입니다.');
 const root=rootId(model.id);
 // A locally saved single-model connection has no purpose after its only model is removed.
 if(root.startsWith('saved:')&&model.id===root){
  await deleteConnection(root);
  return;
 }
 const task=saveQueue.then(async()=>{
  await mkdir(dataDir,{recursive:true});
  const ids=await hiddenModels();
  if(!ids.includes(modelId))await writeFile(hiddenModelsFile,JSON.stringify([...ids,modelId],null,2),{mode:0o600});
 });
 saveQueue=task.then(()=>undefined,()=>undefined);
 await task;
}

export async function deleteConnection(id:string){
 if(modelConnectionsHosted()){
  requirePersonalConnection(id);
  const root=rootId(id),session=await readVisitorModels();
  if(!session.connections.some(item=>item.id===root))throw new Error('개인 연결을 찾지 못했어요.');
  await writeVisitorModels({connections:session.connections.filter(item=>item.id!==root),hiddenModels:session.hiddenModels.filter(item=>rootId(item)!==root)});
  return;
 }
 const root=rootId(id);
 if(!/^(saved|workspace|env|local):/.test(root))throw new Error('삭제할 연결을 찾지 못했습니다.');
 const task=saveQueue.then(async()=>{
  await mkdir(dataDir,{recursive:true});
  if(root.startsWith('saved:')){
   const saved=await loadSaved();
   if(!saved.some(item=>item.id===root))throw new Error('이미 삭제했거나 없는 연결입니다.');
   await writeFile(configFile,JSON.stringify(saved.filter(item=>item.id!==root),null,2),{mode:0o600});
  }else{
   const items=await hiddenConnections();
   if(!items.includes(root))await writeFile(hiddenFile,JSON.stringify([...items,root],null,2),{mode:0o600});
  }
 });
 saveQueue=task.then(()=>undefined,()=>undefined);
 await task;
}

