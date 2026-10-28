import 'server-only';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual,scryptSync} from 'node:crypto';
export const ADMIN_COOKIE='legal-private-admin-v1';
function secret(purpose:string){const raw=process.env.LEGAL_CONNECTION_SECRET;if(!raw||raw.length<32)throw new Error('Private administration is not configured');return createHash('sha256').update(raw+'|'+purpose).digest()}
export function encryptActivity(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret('activity'),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url')}
export function decryptActivity<T>(token:string):T{const bytes=Buffer.from(token,'base64url');const cipher=createDecipheriv('aes-256-gcm',secret('activity'),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8'))}
export function adminPathMatches(value:string){const configured=process.env.LEGAL_ADMIN_PATH;return !!configured&&value===configured&&/^[a-zA-Z0-9_-]{24,100}$/.test(configured)}
export function checkAdminPassword(password:unknown){
 if(typeof password!=='string'||password.length>256)return false;
 const [version,salt,expected]=String(process.env.LEGAL_ADMIN_PASSWORD_HASH||'').split(':');
 if(version!=='s1'||!salt||!expected||!/^[a-f0-9]{128}$/.test(expected))return false;
 const actual=scryptSync(password,salt,64);return timingSafeEqual(actual,Buffer.from(expected,'hex'));
}
export function createAdminSession(now=Date.now()){const payload=Buffer.from(JSON.stringify({expires:now+8*60*60*1000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+createHmac('sha256',secret('admin-session')).update(payload).digest('base64url')}
export function verifyAdminSession(token:string|undefined,now=Date.now()){
 try{if(!token||token.length>500)return false;const [payload,signature]=token.split('.');const expected=createHmac('sha256',secret('admin-session')).update(payload).digest();const supplied=Buffer.from(signature,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(expected,supplied))return false;const {expires}=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return typeof expires==='number'&&expires>now&&expires<=now+8*60*60*1000}catch{return false}
}
export function privateIpKey(ip:string){return createHmac('sha256',secret('login-limit')).update(ip).digest('hex').slice(0,32)}
