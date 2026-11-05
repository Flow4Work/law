/** Public visits are event-driven. Only a visible, active administrator polls. */
export const ACTIVITY_REFRESH_MS=30000;
export const ACTIVITY_IDLE_MS=5*60*1000;
export type ActivityRefreshState='live'|'idle'|'hidden'|'offline';
export function watchActivityRefresh(refresh:()=>void,onState:(state:ActivityRefreshState)=>void){
 let lastInteraction=Date.now();
 const state=():ActivityRefreshState=>document.visibilityState!=='visible'?'hidden':navigator.onLine===false?'offline':Date.now()-lastInteraction>=ACTIVITY_IDLE_MS?'idle':'live';
 const tick=()=>{const next=state();onState(next);if(next==='live')refresh()};
 const interact=()=>{const wasIdle=Date.now()-lastInteraction>=ACTIVITY_IDLE_MS;lastInteraction=Date.now();if(wasIdle)tick()};
 const resume=()=>{lastInteraction=Date.now();tick()};
 const timer=window.setInterval(tick,ACTIVITY_REFRESH_MS);
 window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('offline',tick);
 window.addEventListener('pointermove',interact,{passive:true});window.addEventListener('pointerdown',interact,{passive:true});window.addEventListener('keydown',interact);window.addEventListener('scroll',interact,{passive:true,capture:true});
 document.addEventListener('visibilitychange',resume);onState(state());
 return()=>{window.clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',tick);window.removeEventListener('pointermove',interact);window.removeEventListener('pointerdown',interact);window.removeEventListener('keydown',interact);window.removeEventListener('scroll',interact,true);document.removeEventListener('visibilitychange',resume)};
}
