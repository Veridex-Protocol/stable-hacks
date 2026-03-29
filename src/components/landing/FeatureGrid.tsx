export default function FeatureGrid() {
  return (
    <section id="features" className="relative bg-surface-container-lowest/40 py-24 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-3xl font-headline font-bold mb-4">The Judge-Friendly Flow</h2>
          <div className="h-1 w-20 bg-primary"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group card-surface p-8">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>fingerprint</span>
            </div>
            <h3 className="text-xl font-headline font-bold mb-4">Reconnect with a passkey</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Use the documented Veridex SDK session flow to mint a relayer-backed Auth Session for a real Solana workspace.
            </p>
          </div>
          <div className="group card-surface p-8">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>account_balance_wallet</span>
            </div>
            <h3 className="text-xl font-headline font-bold mb-4">Fund the Solana wallet</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Airdrop devnet SOL, seed treasury liquidity, and make the asset state visible with explorer-linked balances and mint metadata.
            </p>
          </div>
          <div className="group card-surface p-8">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-tertiary/10 text-tertiary mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>receipt_long</span>
            </div>
            <h3 className="text-xl font-headline font-bold mb-4">Settle and archive evidence</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Create x402 payment links or payout claims, complete settlement, and show the receipt plus audit trail in one control plane.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
