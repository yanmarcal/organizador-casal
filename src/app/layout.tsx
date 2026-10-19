import type { Metadata } from 'next';
import './globals.css';
import { CoupleAuthProvider } from '@/lib/context/CoupleAuthContext';

export const metadata: Metadata = {
  title: 'Marçal Contas | Finanças Inteligentes para Casais',
  description:
    'Planilha superpoderosa de organização financeira para casais, divisão de despesas e metas financeiras.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <CoupleAuthProvider>{children}</CoupleAuthProvider>
      </body>
    </html>
  );
}
