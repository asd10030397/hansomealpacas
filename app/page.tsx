import { AboutSection } from "@/sections/AboutSection";
import { BuySection } from "@/sections/BuySection";
import { DexToolsChartSection } from "@/sections/DexToolsChartSection";
import { MarketStatsSection } from "@/sections/MarketStatsSection";
import { ContractSection } from "@/sections/ContractSection";
import { FaqSection } from "@/sections/FaqSection";
import { FooterSection } from "@/sections/FooterSection";
import { HeroSection } from "@/sections/HeroSection";
import { LiveStatusSection } from "@/sections/LiveStatusSection";
import { TokenomicsSection } from "@/sections/TokenomicsSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <LiveStatusSection />
      <TokenomicsSection />
      <BuySection />
      <ContractSection />
      <MarketStatsSection />
      <DexToolsChartSection />
      <AboutSection />
      <FaqSection />
      <FooterSection />
    </main>
  );
}
