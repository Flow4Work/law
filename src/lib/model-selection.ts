import type {ModelInventory} from './model-types';

export function selectedModelId(inventory:ModelInventory|null,caseId?:string,preferredId?:string):string{
 const available=(id?:string)=>Boolean(id&&inventory?.models.some(model=>model.id===id&&model.available));
 return [caseId,preferredId,inventory?.defaultId].find(available)||inventory?.models.find(model=>model.available)?.id||'';
}
export function providerName(provider:string):string{
 return ({glm:'GLM / Z.AI',openrouter:'OpenRouter',opencode:'OpenCode',gemini:'Google Gemini',bai:'B.AI',local:'로컬 서버',custom:'다른 API'} as Record<string,string>)[provider]||provider;
}
