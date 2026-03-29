"use client";

import { useMemo, type ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEVNET_RPC = "https://api.devnet.solana.com";

export default function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => DEVNET_RPC, []);

  // Modern wallet standard: Phantom, Solflare, Backpack, Coinbase Wallet,
  // and all other wallets that register via the Wallet Standard are
  // auto-detected — no explicit adapter imports needed.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
