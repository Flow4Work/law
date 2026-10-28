export function retryDelay(value:string|null,attempt:number,now=Date.now()):number{
 const seconds=value?Number(value):NaN;
 const date=value?Date.parse(value):NaN;
 return Math.min(30000,Math.max(1000,Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now:Math.min(15000,3000*2**attempt)));
}
type Waiter={resolve:(release:()=>void)=>void;reject:(reason:unknown)=>void;signal?:AbortSignal;abort:()=>void};
export class RequestQueue{
 private active=false;private waiting:Waiter[]=[];
 acquire(signal?:AbortSignal):Promise<()=>void>{
  if(signal?.aborted)return Promise.reject(new Error('요청을 취소했어요.'));
  if(!this.active){this.active=true;return Promise.resolve(this.release)}
  return new Promise((resolve,reject)=>{const waiter:Waiter={resolve,reject,signal,abort:()=>{this.waiting=this.waiting.filter(w=>w!==waiter);reject(new Error('요청을 취소했어요.'))}};this.waiting.push(waiter);signal?.addEventListener('abort',waiter.abort,{once:true})});
 }
 private release=()=>{const next=this.waiting.shift();if(next){next.signal?.removeEventListener('abort',next.abort);next.resolve(this.release)}else this.active=false};
 get busy(){return this.active}
}
