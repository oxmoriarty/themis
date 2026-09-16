"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import logoBlack from "../../docs-source/branding/themisLogoBlack.png";
import logoWhite from "../../docs-source/branding/themisLogoWhite.png";
import { SessionProvider, useSession } from "@/components/session-context";

const navItems = [
  ["Explore", "/explore"],
  ["Create matter", "/matters/new"],
  ["Developer", "/developer"],
] as const;

function Header() {
  const pathname = usePathname();
  const { connectWallet, walletAddress } = useSession();
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Themis home"><Image src={logoWhite} alt="Themis" priority /></Link>
      <nav className="topnav" aria-label="Primary navigation">
        {navItems.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className="top-actions">
        {walletAddress && <span className="wallet-state" title={walletAddress}>{walletAddress}</span>}
        <button type="button" className="button button--light" onClick={() => void connectWallet()}>
          <Wallet size={15} aria-hidden="true" /> {walletAddress ? "Studio Next" : "Connect wallet"}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="main footer">
      <Image src={logoBlack} alt="Themis" />
      <span>Prototype coordination and adjudication infrastructure. Not legal advice or representation.</span>
      <Link href="/explore">Explore services <ArrowUpRight size={14} aria-hidden="true" /></Link>
    </footer>
  );
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return <SessionProvider><div className="shell"><Header /><main className="main">{children}</main><Footer /></div></SessionProvider>;
}
