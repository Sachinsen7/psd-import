import Hero from '@/components/Hero';
import PsdImporter from '@/components/PsdImporter';

export default function Home() {
    return (
        <main className="min-h-screen">
            <Hero />
            <PsdImporter />
            <footer className="pb-10 text-center text-xs text-black/40">
                Built as a standalone demo — parses PSD files locally in your browser.
            </footer>
        </main>
    );
}
