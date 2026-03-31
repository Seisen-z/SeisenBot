import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import ClientLayout from '@/components/layout/ClientLayout';
import { ToastProvider } from '@/components/ui/toast';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Seisen Hub Dashboard',
  description: 'Configuration for Seisen Hub Bot',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token');

  return (
    <html lang="en" className="dark h-full">
      <body className={cn("h-full bg-discord-dark text-discord-text antialiased")}>
        <ToastProvider>
          <ClientLayout isAuthenticated={!!token}>
            {children}
          </ClientLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
