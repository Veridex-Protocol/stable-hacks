import "./globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settla | Solana Treasury Workspace",
  description: "Passkey-first treasury operations, payment links, and settlement evidence on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-surface font-body text-on-surface antialiased selection:bg-primary selection:text-on-primary">
        {children}
      </body>
    </html>
  );
}
