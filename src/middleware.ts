import {NextRequest,NextResponse} from 'next/server';
export function middleware(request:NextRequest){const headers=new Headers(request.headers);headers.set('x-site-locale',request.nextUrl.pathname.startsWith('/en')?'en':'ko');return NextResponse.next({request:{headers}})}
export const config={matcher:['/','/en','/en/:path*']};
