      import Link from 'next/link';
      
      export default function Navbar() {
        return (
          <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#0f172a]/75 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
              <Link href="/" className="text-2xl font-bold tracking-tight text-primary font-headline">Settla</Link>
              <div className="hidden md:flex items-center gap-8">
                <a className="text-sm tracking-wide font-semibold text-primary border-b-2 border-primary pb-1 transition-all duration-300" href="#features">Workflow</a>
                <a className="text-sm tracking-wide font-medium text-on-surface-variant hover:text-on-surface transition-all duration-300" href="#solana">Why Solana</a>
                <a className="text-sm tracking-wide font-medium text-on-surface-variant hover:text-on-surface transition-all duration-300" href="#compliance">Evidence</a>
              </div>
              <Link href="/auth" className="primary-gradient text-on-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm tracking-wide active:scale-95 duration-200 shadow-2xl shadow-primary/20">
                Open Workspace
              </Link>
            </div>
          </nav>
        );
      }
