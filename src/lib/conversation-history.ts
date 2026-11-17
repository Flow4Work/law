import type {LegalCase} from './types';

export function isSavedConversation(value:LegalCase):boolean{
 return !value.demo&&!value.examplePreset&&Boolean(
  value.messages?.length||value.nodes?.length||value.edges?.length||
  value.facts?.length||value.sources?.length||value.intake
 );
}
