export default function WhySolana() {
  return (
    <section id="solana" className="py-24 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="aspect-square panel-soft bg-gradient-to-tr from-primary/10 to-secondary/10 p-8 relative">
              {/* Visual: Conceptual Digital Vault */}
              <div className="w-full h-full border border-outline-variant/20 rounded-2xl flex items-center justify-center">
                <img className="w-full h-full object-cover rounded-2xl opacity-40 mix-blend-screen" data-alt="Abstract glowing 3D blockchain node structure" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAT4X2c3jGVfYRoyEEAS9EwMfnOBlQ14GI9xDcNGUDFtTQKTFkTk-5glJYwHguy0GfHgnD-Ee_Krkb-dGroy5GzBsKREwE3IH08MUui_4zg1LEIJsSv74ZVDVgk-leCWx7iTL9Bc6sTXvH-RW1hgDqXZwkijeku8D2W4e5KAAKRb1cpDwF4LOWlABA-VveIhdTbsCzk4bdTDwHPKHLgQfYUUXqSz6SMHXmSfEHc9vn0t1ZC9a36A6zkGQrccTFsaychc3zHkANTsNU"/>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-surface/80 backdrop-blur-md px-8 py-4 rounded-full border border-primary/30 flex items-center gap-4 shadow-xl shadow-primary/15">
                  <span className="text-2xl font-bold font-headline text-primary">400ms</span>
                  <span className="text-sm opacity-60">Avg. Finality</span>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-4xl font-headline font-extrabold mb-8 leading-tight">Built for Solana.<br/>Shaped for treasury operators.</h2>
            <div className="space-y-8">
              <div>
                <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Fast settlement feedback
                </h4>
                <p className="text-on-surface-variant text-sm">Receipts, funding events, and payout claims resolve quickly enough to make live demo and operator workflows feel immediate.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Low-friction payment rails
                </h4>
                <p className="text-on-surface-variant text-sm">Cheap transactions make x402-style collection links and frequent treasury actions practical for both humans and agents.</p>
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Stable asset friendly
                </h4>
                <p className="text-on-surface-variant text-sm">The workspace can seed and track a treasury-managed stable asset, then expose mint addresses, explorer links, and receipt details across the app.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
