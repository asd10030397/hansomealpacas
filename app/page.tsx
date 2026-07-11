import { AboutSection } from "@/sections/AboutSection";
import { BuySection } from "@/sections/BuySection";
import { ContractSection } from "@/sections/ContractSection";
import { DeerTrailSection } from "@/sections/DeerTrailSection";
import { DeerVoteSection } from "@/sections/DeerVoteSection";
import { FooterSection } from "@/sections/FooterSection";
import { HeroSection } from "@/sections/HeroSection";
import { TokenomicsSection } from "@/sections/TokenomicsSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <TokenomicsSection />
      <BuySection />
      <ContractSection />
      <AboutSection />
      <DeerVoteSection />
      <DeerTrailSection />
      <FooterSection />
    </main>
  );
}
