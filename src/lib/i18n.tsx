'use client';
import {createContext,useCallback,useContext,useEffect,type ReactNode} from 'react';
import english from './translations-en.json';
export type Language='ko'|'en';
const Context=createContext<Language>('ko');
const dictionary:Record<string,string>=english;
export function LanguageProvider({locale,children}:{locale:Language;children:ReactNode}){
 useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dataset.locale=locale;},[locale]);
 return <Context.Provider value={locale}>{children}</Context.Provider>;
}
export function useLocale(){return useContext(Context)}
export function translate(value:string,locale:Language):string {
 if(locale==='ko'||!value)return value;
 const direct=dictionary[value];if(direct!==undefined)return direct;
 const core=value.trim();const translated=dictionary[core];
 if(translated!==undefined)return value.slice(0,value.indexOf(core))+translated+value.slice(value.indexOf(core)+core.length);
 const duration=core.match(/^약\s*(\d+(?:\s*[~～–-]\s*\d+)?)\s*(일|주|개월|달|년)$/);
 if(duration){const unit:{[key:string]:string}={일:'days',주:'weeks',개월:'months',달:'months',년:'years'};return 'About '+duration[1].replace(/\s*[~～-]\s*/g,'–')+' '+unit[duration[2]];}
 if(/^\d+개$/.test(core))return core.replace('개','');
 if(core==='없음')return 'None';
 if(!/[가-힣]/.test(core))return value;
 return value;
}
export function useT(){const locale=useLocale();return useCallback((value:string)=>translate(value,locale),[locale])}
