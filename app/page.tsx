import { AboutSection } from "@/sections/AboutSection";
import { BuySection } from "@/sections/BuySection";
import { ContractSection } from "@/sections/ContractSection";
import { FaqSection } from "@/sections/FaqSection";
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
      <FaqSection />
      <FooterSection />
    </main>
  );
}
