import type {ScenarioOutcome,ScenarioTransition} from './types';

/** A missing follow-up is never, by itself, proof that a legal matter has ended. */
export function isTerminalOutcome(outcome:ScenarioOutcome):boolean{
 if(outcome.terminal===false)return false;
 if(outcome.terminal===true)return true;
 const title=outcome.title.replace(/\s/g,'');
 const condition=(outcome.condition||'').replace(/\s/g,'');
 // Only explicit procedural endings; a final judgment or successful attachment
 // does NOT mean the creditor has received the money.
 const certain=/(?:합의|조정)성립|합의완료|사건종결|절차종료|수사종결|전액(?:지급|회수|변제|수령)|(?:전부|모두)(?:지급|회수|변제)|완납|전액입금/.test(title)
  ||/(?:합의|조정)(?:이|가)?성립(?:하|되|했|한|하면|되면)/.test(condition)&&!/불성립|미성립|불이행/.test(title);
 const notFinal=/불성립|미성립|불이행|미지급|미회수|일부|부분|불복|이의|실패|예상|가능성|조건부/.test(title);
 return certain&&!notFinal;
}

export function completionText(outcome:ScenarioOutcome):string{
 const label=outcome.title.replace(/\s/g,'');
 if(/합의|조정/.test(label))return '합의·조정 절차가 종료돼요. 약속한 지급이나 이행이 남았다면 따로 확인해야 해요.';
 if(/전액|전부|모두|완납/.test(label))return '받기로 한 금액을 모두 받은 경우예요. 실제 수령액과 남은 채권이 없는지 확인해요.';
 return '해당 절차가 종료되는 경우예요. 별도 이행이나 불복 절차가 남았는지는 확인해야 해요.';
}

/** Match only a clearly supported conditional handoff, never link every result to every route. */
export function matchingTransitions(outcome:ScenarioOutcome,transitions:ScenarioTransition[]):ScenarioTransition[]{
 const left=(outcome.title+' '+(outcome.condition||'')).replace(/\s/g,'');
 const matches=(transition:ScenarioTransition)=>{
  const right=(transition.condition+' '+(transition.label||'')).replace(/\s/g,'');
  const negative=/이의(?:신청)?(?:가|를|을)?(?:없|않)|이의없이|이의하지않/.test(left);
  const success=/(성립|합의완료|전액지급|전액회수|지급완료|회수완료)/.test(left);
  const adverse=/(이의|불복|불성립|결렬|거부|거절|실패|미지급)/.test(right);
  const failed=/(불성립|결렬|미지급|거부|거절|기각|패소)/.test(left);
  if((success&&adverse)||(failed&&/(성립|전액지급|지급완료|회수완료)/.test(right)))return false;
  if(!negative&&/이의|불복/.test(left)&&/이의|불복/.test(right))return true;
  if(!negative&&/소송/.test(left)&&/소송/.test(right))return true;
  const tags=[/압류|추심|강제집행/,/재산조회|재산명시|숨은재산/,/지급|변제|입금/,/합의|조정/,/항소|상고/,/고소|수사/,/보정|추가서류/];
  return tags.some(tag=>tag.test(left)&&tag.test(right)&&!/못|불가|불능|거절|어려|불이행|실패/.test(left));
 };
 return transitions.filter(matches);
}
