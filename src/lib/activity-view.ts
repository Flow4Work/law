import {ACTIVITY_LABELS,isActivitySite,type ActivityEvent,type ActivitySite} from './activity-types';

export type ActivityFilters={search:string;action:string;location:string;newest:boolean};
export type ActivityView=ActivityFilters&{site:ActivitySite;days:number;source:'database'|'archive';date:string};
export const defaultActivityFilters:ActivityFilters={search:'',action:'all',location:'all',newest:true};
export function parseActivityView(query:URLSearchParams):ActivityView{
 const site=query.get('site'),days=Number(query.get('days')||1),action=query.get('action')||'all',location=query.get('location')||'all';
 const date=query.get('date')||new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 return {...defaultActivityFilters,site:isActivitySite(site)?site:'law',days:[1,7,30].includes(days)?days:1,
  source:query.get('source')==='archive'?'archive':'database',date:/^20\d{2}-\d{2}-\d{2}$/.test(date)?date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
  action:action==='all'||Object.hasOwn(ACTIVITY_LABELS,action)?action:'all',location:['all','district','missing','high','medium','low'].includes(location)?location:'all',newest:query.get('order')!=='oldest'};
}
/** Only non-sensitive view settings belong in the URL. Search text stays in memory. */
export function activityViewQuery(view:ActivityView){
 return new URLSearchParams({site:view.site,days:String(view.days),source:view.source,...(view.source==='archive'?{date:view.date}:{}),action:view.action,location:view.location,order:view.newest?'newest':'oldest'});
}
export function activityMatches(event:ActivityEvent,filters:ActivityFilters){
 const level=!event.district?'':event.districtConfidence||(event.districtSource==='ip-postal'?'high':event.districtSource==='ip-coordinate'?'low':'medium');
 if(filters.action!=='all'&&event.action!==filters.action)return false;
 if(filters.location==='district'&&!event.district||filters.location==='missing'&&event.district||['high','medium','low'].includes(filters.location)&&level!==filters.location)return false;
 const country=event.country&&/^[A-Z]{2}$/.test(event.country)?new Intl.DisplayNames(['ko'],{type:'region'}).of(event.country):'';
 const text=[event.ip,event.ipVersion,event.page,event.location,event.city,event.district,country,event.isp,event.districtEvidence,event.detail,ACTIVITY_LABELS[event.action]].join(' ').toLowerCase();
 return text.includes(filters.search.trim().toLowerCase());
}
