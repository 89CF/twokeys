"use client";

import { Buffer } from "buffer";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Toaster } from "sonner";
import { RPC_URL } from "@/lib/config";
import { DEMO_WALLETS_ENABLED, DEMO_WALLET_IDS, DemoWalletAdapter } from "@/lib/demoWallets";

import "@solana/wallet-adapter-react-ui/styles.css";

// Anchor and spl-token expect a global Buffer in the browser.
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}

export function Providers({ children }: { children: ReactNode }) {
  // Phantom and Solflare are also discovered via Wallet Standard; explicit adapters keep them listed when not installed.
  // Demo Seller / Buyer / Visitor are devnet-only in-browser keypairs for solo demos and E2E tests.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
      ...(DEMO_WALLETS_ENABLED ? DEMO_WALLET_IDS.map((id) => new DemoWalletAdapter(id)) : []),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: "var(--font-geist-sans)" } }}
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
