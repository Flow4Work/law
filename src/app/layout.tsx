import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '법률 로드맵 | 복잡한 고민, 한 걸음씩',
  description: '내 상황을 편하게 이야기하고, 가능한 방법과 그다음 상황을 한눈에 살펴봐요.',
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}