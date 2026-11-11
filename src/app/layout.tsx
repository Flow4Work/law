import type { Metadata } from 'next';
import {headers} from 'next/headers';
import './globals.css';
import {ActivityRecorder} from '@/features/workspace/activity-recorder';

export const metadata: Metadata = {
  title: '법률 로드맵 | 복잡한 고민, 한 걸음씩',
  description: '내 상황을 편하게 이야기하고, 가능한 방법과 그다음 상황을 한눈에 살펴봐요.',
  metadataBase:new URL('https://law-lake-theta.vercel.app'),
  alternates:{canonical:'/',languages:{'ko-KR':'/','en-US':'/en'}},
};
export default async function RootLayout({children}:{children:React.ReactNode}) {
  const locale=(await headers()).get('x-site-locale')==='en'?'en':'ko';
  return <html lang={locale}><body>{children}<ActivityRecorder/></body></html>;
}
