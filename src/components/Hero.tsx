export default function Hero() {
    return (
        <section className="mx-auto max-w-4xl px-6 pb-8 pt-20 text-center">
            <span className="inline-block rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black/50">
                Demo
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">PSD Import, done simply</h1>
            <p className="mx-auto mt-4 max-w-xl text-black/60">
                Upload a Photoshop file and its layers land on a live, editable canvas in seconds — move,
                resize, hide, or remove any of them.
            </p>
            <a
                href="#import"
                className="mt-8 inline-block rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/80"
            >
                Try it below
            </a>
        </section>
    );
}
