import { ScanClient } from "@/components/scan/ScanClient";

export const metadata = {
  title: "HANSOME Scan — Robinhood Chain On-Chain Analytics",
  description:
    "Free public-beta on-chain transparency and structural analytics tool for Robinhood Chain.",
};

export default function ScanPage() {
  return <ScanClient />;
}
