export default function Footer() {
  return (
    <footer className="w-full py-12 px-8 border-t border-white/10 bg-[#0b1326]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-1">
          <div className="text-lg font-bold text-on-surface mb-6 font-headline">Settla</div>
          <p className="text-xs opacity-70 leading-relaxed text-on-surface-variant">
            Passkey-first treasury operations on Solana. <br/>
            Agent-compatible payment rails with receipts and evidence.
          </p>
        </div>
        <div>
          <h5 className="font-headline font-bold text-sm mb-4 text-on-surface">Product</h5>
          <ul className="space-y-2">
            <li><a className="text-xs opacity-70 text-on-surface-variant hover:text-primary transition-colors" href="#features">Demo Workflow</a></li>
            <li><a className="text-xs opacity-70 text-on-surface-variant hover:text-primary transition-colors" href="#solana">Why Solana</a></li>
            <li><a className="text-xs opacity-70 text-on-surface-variant hover:text-primary transition-colors" href="/auth">Workspace Sign-In</a></li>
          </ul>
        </div>
        <div>
          <h5 className="font-headline font-bold text-sm mb-4 text-on-surface">Proof</h5>
          <ul className="space-y-2">
            <li><a className="text-xs opacity-70 text-on-surface-variant hover:text-primary transition-colors" href="#compliance">Receipts & Evidence</a></li>
            <li><a className="text-xs opacity-70 text-on-surface-variant hover:text-primary transition-colors" href="/auth">Passkey Auth Flow</a></li>
          </ul>
        </div>
        <div>
          <h5 className="font-headline font-bold text-sm mb-4 text-on-surface">Connect</h5>
          <div className="flex gap-4">
            <a className="opacity-70 hover:opacity-100 hover:text-primary transition-all" href="#"><span className="material-symbols-outlined text-xl">share</span></a>
            <a className="opacity-70 hover:opacity-100 hover:text-primary transition-all" href="#"><span className="material-symbols-outlined text-xl">terminal</span></a>
            <a className="opacity-70 hover:opacity-100 hover:text-primary transition-all" href="#"><span className="material-symbols-outlined text-xl">support_agent</span></a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-center">
        <p className="text-xs opacity-70 text-on-surface-variant">© 2026 Settla. All rights reserved. Passkey-first treasury operations on Solana.</p>
      </div>
    </footer>
  );
}
