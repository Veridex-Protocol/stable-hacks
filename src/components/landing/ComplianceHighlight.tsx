export default function ComplianceHighlight() {
  return (
    <section id="compliance" className="py-24 px-8 bg-gradient-to-b from-surface to-surface-container-lowest/60">
      <div className="max-w-5xl mx-auto panel p-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-headline font-bold mb-6">Receipts, Sessions, and Evidence</h2>
            <p className="text-on-surface-variant mb-8 leading-relaxed">
              The production story is not just that payments settle on Solana. It is that every reconnect, funding event, payment link, payout claim, and receipt leaves behind evidence the team can actually operate from.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>check</span>
                </span>
                <span className="text-sm font-medium">Relayer-backed Auth Session history</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>check</span>
                </span>
                <span className="text-sm font-medium">Explorer-linked receipts and signatures</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>check</span>
                </span>
                <span className="text-sm font-medium">Prisma-backed asset, invoice, and claim records</span>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined">verified</span>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">Receipt archived</div>
                  <div className="text-sm opacity-80">Solana settlement signature captured</div>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary">shield</span>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-error/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined">key</span>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-error">Session expired</div>
                  <div className="text-sm opacity-80">Reconnect the passkey and mint a fresh Auth Session</div>
                </div>
              </div>
              <span className="material-symbols-outlined text-error">autorenew</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
