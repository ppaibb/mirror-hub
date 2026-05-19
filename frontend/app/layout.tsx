import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Gua CR - Container Registry Mirror',
  description: 'Fast and reliable container image mirror for developers in mainland China.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#F8FAFC] text-slate-900 font-sans antialiased selection:bg-blue-500/30 min-h-screen flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
