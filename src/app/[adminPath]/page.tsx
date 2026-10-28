import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {PrivateActivityConsole} from '@/features/private-activity/console';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'활동 기록 | Private',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function PrivateActivityPage({params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))notFound();
 const loggedIn=verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
 return <PrivateActivityConsole initiallyAuthenticated={loggedIn}/>;
}
