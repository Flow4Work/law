export function modelRequestAllowed(request:Request){
 const origin=request.headers.get('origin');
 if(!origin)return true;
 try{
  const source=new URL(origin),destination=new URL(request.url);
  if(source.origin===destination.origin)return true;
  const loopback=new Set(['localhost','127.0.0.1','[::1]']);
  return source.protocol==='http:'&&destination.protocol==='http:'&&source.port===destination.port
   &&loopback.has(source.hostname)&&loopback.has(destination.hostname);
 }catch{return false}
}
