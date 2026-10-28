import 'server-only';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

export function publicModelAddress(address:string){
 const ip=address.toLowerCase().replace(/^\[|\]$/g,'');
 if(isIP(ip)===4){
  const [a,b]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224||a===198&&(b===18||b===19));
 }
 // Public global-unicast IPv6 only; this also excludes mapped loopback/private IPv4.
 return isIP(ip)===6&&/^[23][0-9a-f]{3}:/.test(ip)&&!ip.startsWith('2001:db8:');
}
export async function validateModelEndpoint(baseUrl:string){
 if(process.env.VERCEL!=='1')return;
 const url=new URL(baseUrl),host=url.hostname.replace(/^\[|\]$/g,'');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443')throw new Error('공개 서비스에서는 HTTPS API 주소를 사용해주세요.');
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||!host.includes('.'))throw new Error('외부에서 접속할 수 있는 AI 서비스 주소를 입력해주세요.');
 const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(item=>!publicModelAddress(item.address)))throw new Error('로컬 또는 내부 네트워크 주소는 공개 서비스에서 연결할 수 없어요.');
}
