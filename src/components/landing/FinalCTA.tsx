      import Link from 'next/link';
      
      export default function FinalCTA() {
        return (
          <section className="py-32 px-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 -z-10 blur-[150px] rounded-full translate-y-1/2"></div>
            <div className="max-w-3xl mx-auto panel p-10 md:p-14">
              <h2 className="text-5xl font-headline font-extrabold mb-8">Ready to run the full Solana workflow?</h2>
              <p className="text-on-surface-variant text-lg mb-12">Reconnect the passkey, fund the wallet, create the rail, and show the receipt trail from one production-style workspace.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link href="/auth" className="primary-gradient text-on-primary px-10 py-5 rounded-lg font-headline font-extrabold text-lg shadow-2xl shadow-primary/20 active:scale-95 transition-all">
                  Open Workspace
                </Link>
                <Link href="#features" className="secondary-ghost px-10 py-5 rounded-lg font-headline font-extrabold text-lg">
                  Review Demo Path
                </Link>
              </div>
            </div>
          </section>
        );
      }
