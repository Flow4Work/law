import type {ModelChoice,ModelInventory} from './model-types';

export function selectedModelId(inventory:ModelInventory|null,caseId?:string,preferredId?:string):string{
 const available=(id?:string)=>Boolean(id&&inventory?.models.some(model=>model.id===id&&model.available));
 return [caseId,preferredId,inventory?.defaultId].find(available)||inventory?.models.find(model=>model.available)?.id||'';
}
/** Short label for the model currently selected in the chat composer. */
export function composerModelLabel(model?:Pick<ModelChoice,'provider'|'model'>|null):string{
 if(!model)return 'GPT';
 const id=model.model.toLowerCase();
 if(model.provider==='glm'||/^glm[-_/]/.test(id))return 'GLM';
 if(id.includes('minimax')||id.includes('mini-max'))return 'MiniMax';
 if(/(?:^|[\/_])gpt[-_]/.test(id)||id.startsWith('openai/'))return 'GPT';
 if(id.includes('gemini'))return 'Gemini';
 if(id.includes('claude'))return 'Claude';
 if(id.includes('gemma'))return 'Gemma';
 return ({bai:'GPT',gemini:'Gemini',opencode:'OpenCode',openrouter:'모델',local:'로컬',custom:'모델'} as Record<string,string>)[model.provider]||'모델';
}
export function providerName(provider:string):string{
 return ({glm:'GLM / Z.AI',openrouter:'OpenRouter',opencode:'OpenCode',gemini:'Google Gemini',bai:'B.AI',local:'로컬 서버',custom:'다른 API'} as Record<string,string>)[provider]||provider;
}
