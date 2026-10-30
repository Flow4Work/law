import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {PrivateActivityConsole} from '@/features/private-activity/console';
import {parseActivityView} from '@/lib/activity-view';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'활동 기록 | Private',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function PrivateActivityPage({params,searchParams}:{params:Promise<{adminPath:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))notFound();
 const loggedIn=verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
 const query=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams))if(typeof value==='string')query.set(key,value);
 return <PrivateActivityConsole initiallyAuthenticated={loggedIn} initialView={parseActivityView(query)} archiveAvailable={!!process.env.BLOB_READ_WRITE_TOKEN}/>;
}
