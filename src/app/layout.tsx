import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Market Mayhem',
  description: 'Market Mayhem game platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
