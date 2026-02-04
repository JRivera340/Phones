import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Detector de Celulares',
  description: 'Detector de celulares usando Teachable Machine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
