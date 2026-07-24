import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'PSD Import — Demo',
    description: 'A minimal demo: upload a PSD file and edit its layers on a live canvas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="antialiased text-ink">{children}</body>
        </html>
    );
}
