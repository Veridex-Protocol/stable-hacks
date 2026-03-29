export default function PayoutPipeline() {
  return (
    <section className="py-24 px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-headline font-extrabold mb-4">The Live Demo Sequence</h2>
          <p className="text-on-surface-variant max-w-2xl mx-auto">A single four-step path that takes judges from passkey reconnect to Solana receipt evidence without changing products mid-demo.</p>
        </div>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-outline-variant/20 -translate-y-1/2 hidden lg:block"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-outline-variant/30 flex items-center justify-center mb-6 z-10 group-hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-on-surface">fingerprint</span>
              </div>
              <h4 className="font-headline font-bold mb-2">1. Reconnect Workspace</h4>
              <p className="text-xs text-on-surface-variant px-4">The operator reconnects an existing Veridex passkey and mints a live Auth Session.</p>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-outline-variant/30 flex items-center justify-center mb-6 z-10 group-hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-on-surface">savings</span>
              </div>
              <h4 className="font-headline font-bold mb-2">2. Fund Treasury Wallet</h4>
              <p className="text-xs text-on-surface-variant px-4">The dashboard airdrops devnet SOL and seeds the managed stable asset for live Solana settlement.</p>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-outline-variant/30 flex items-center justify-center mb-6 z-10 group-hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-on-surface">link</span>
              </div>
              <h4 className="font-headline font-bold mb-2">3. Create the Payment Rail</h4>
              <p className="text-xs text-on-surface-variant px-4">Issue an x402 collection link or a payout claim that can be redeemed by a human or an agent.</p>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center mb-6 z-10">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
              </div>
              <h4 className="font-headline font-bold mb-2">4. Show Receipt + Audit</h4>
              <p className="text-xs text-on-surface-variant px-4 text-primary">Settlement signatures, explorer links, receipts, and evidence land back inside the workspace.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
