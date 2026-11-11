export type ApiLocale='ko'|'en';
export function localeInstruction(locale:ApiLocale){
 if(locale!=='en')return '';
 return `
\nFINAL OVERRIDING LANGUAGE RULES FOR ENGLISH UI:
- This request is for the English-language version of a South Korean legal roadmap. ALL user-facing natural-language JSON values MUST be written in fluent, natural English, regardless of the Korean wording or Korean-only style rules earlier in this prompt. Apply the earlier Korean rules for legal accuracy, logic, evidence, structure, and safety, but NOT for output language or Korean character counts.
- Write concise, plain-language headings (usually 2–7 English words) and readable explanations (1–2 complete English sentences). Keep outcome titles, step titles, labels, answer, risk details, conditions, follow-up questions, choice buttons, fees, durations and status messages in English. Do not transliterate whole Korean sentences or mix languages in ordinary content.
- The legal jurisdiction is the Republic of Korea (South Korea). Retain official statute and court names in their original Korean form only in sourceQueries.laws and sourceQueries.precedents so the Korean law search can work, and optionally in parentheses when legally important. Explain the institution/procedure in English.
- Never invent legal remedies, deadlines, eligibility, costs, required documents or success probabilities. Label uncertainty accurately, preserve citations and distinctions between completed and possible steps.
- Keep JSON keys, IDs, enum values, sourceIds, and field names EXACTLY as specified. Do not translate machine-readable keys or status values.
- If explaining a duration without a verified source, do not invent a number. If verified, use wording like "about 2–4 weeks". Do not interpret legal deadlines as average processing times.
- Make the response directly usable by an English-speaking visitor. No Korean honorific sentence endings. No meta comments about translation.
`;
}
export function legalLookupText(story:string,locale:ApiLocale):string{
 if(locale!=='en')return story;
 const tags:string[]=[];
 if(/wage|salary|severance|unpaid pay|paycheck|labor|employment|fired|dismissal/i.test(story))tags.push('임금체불 퇴직금 근로기준법');
 if(/deposit|landlord|tenant|lease|rental|rent|housing/i.test(story))tags.push('임대차 보증금 반환');
 if(/police|criminal|prosecution|investigation|assault|stalking|complaint/i.test(story))tags.push('경찰 형사 고소');
 if(/judgment|enforce|garnish|seize|execution|attachment|asset/i.test(story))tags.push('민사 판결 강제집행 압류');
 return story+'\n'+tags.join(' ');
}
