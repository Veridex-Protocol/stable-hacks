import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative flex min-h-[860px] items-center overflow-hidden px-8 pt-8">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xs font-headline font-bold text-primary tracking-widest uppercase">Passkey-first treasury on Solana devnet</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight mb-6 leading-[1.05]">
            Reconnect with a passkey. <br/>
            <span className="text-primary text-glow">Operate payments on Solana.</span>
          </h1>
          <p className="text-on-surface-variant text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
            Settla is the Solana treasury workspace for agent-compatible payment links, payout claims, invoices, receipts, and audit-ready settlement evidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/auth" className="primary-gradient text-on-primary px-8 py-4 rounded-xl font-headline font-bold text-base shadow-xl shadow-primary/20 active:scale-95 transition-all">
              Open Workspace
            </Link>
            <Link href="#features" className="secondary-ghost px-8 py-4 rounded-xl font-headline font-bold text-base">
              View Demo Flow
            </Link>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="absolute -inset-10 bg-primary/5 blur-[120px] rounded-full"></div>
          <div className="glass-panel p-1 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="bg-surface-container-lowest rounded-lg p-6 min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-error/40"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary/40"></div>
                  <div className="w-3 h-3 rounded-full bg-primary/40"></div>
                </div>
                <div className="text-[10px] font-mono text-outline uppercase tracking-widest">Solana Treasury Control Plane</div>
              </div>
              {/* Treasury workspace preview */}
              <div className="space-y-4" id="developers">
                <div className="h-8 w-2/3 bg-surface-container rounded animate-pulse"></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-20 bg-surface-container rounded-lg border border-outline-variant/10"></div>
                  <div className="h-20 bg-surface-container rounded-lg border border-outline-variant/10"></div>
                  <div className="h-20 bg-surface-container rounded-lg border border-outline-variant/10"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-surface-container rounded"></div>
                  <div className="h-4 w-5/6 bg-surface-container rounded"></div>
                  <div className="h-4 w-4/6 bg-surface-container rounded"></div>
                </div>
                <div className="pt-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-sm" style={{fontVariationSettings: "'FILL' 1"}}>shield</span>
                      <span className="text-xs font-mono text-primary">Receipt + audit evidence archived</span>
                    </div>
                    <div className="h-2 w-16 bg-primary/30 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-primary"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-secondary/10 blur-[80px] rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
