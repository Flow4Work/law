const loopback=(hostname:string)=>hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]';
/**
 * The portfolio is a static site on another origin, so only its own production and
 * preview hosts (plus local preview servers) may write records for the Portfolio tab.
 */
export function portfolioOriginAllowed(origin:string|null){
 if(!origin)return false;
 try{
  const {protocol,hostname}=new URL(origin);
  if(protocol==='https:'&&(hostname==='leopark-portfolio.vercel.app'||/^leopark-portfolio-[a-z0-9-]+\.vercel\.app$/.test(hostname)))return true;
  return protocol==='http:'&&loopback(hostname);
 }catch{return false}
}
