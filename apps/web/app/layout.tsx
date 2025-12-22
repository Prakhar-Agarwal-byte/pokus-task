import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pokus AI - Real-World Task Completion',
  description: 'AI-powered multi-agent system for completing real-world tasks like finding medicine and planning travel.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <CopilotKit runtimeUrl="/api/copilotkit" agent='supervisor'>
          {children}
          <Toaster />
        </CopilotKit>
      </body>
    </html>
  );
}
