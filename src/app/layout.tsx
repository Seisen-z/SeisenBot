import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import ClientLayout from '@/components/layout/ClientLayout';
import { ToastProvider } from '@/components/ui/toast';

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  preload: false,
});

const displayFont = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  preload: false,
});


export const metadata: Metadata = {
  title: {
    default: 'Seisen Hub Dashboard',
    template: '%s | Seisen Hub',
  },
  description: 'Configuration for Seisen Hub Bot',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className={cn(bodyFont.variable, displayFont.variable, 'h-full bg-discord-dark text-discord-text antialiased')}>
        <ToastProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
