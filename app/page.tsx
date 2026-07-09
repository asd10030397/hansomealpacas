import { AboutSection } from "@/sections/AboutSection";
import { ContractSection } from "@/sections/ContractSection";
import { DeerTrailSection } from "@/sections/DeerTrailSection";
import { DeerVoteSection } from "@/sections/DeerVoteSection";
import { FooterSection } from "@/sections/FooterSection";
import { HeroSection } from "@/sections/HeroSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AboutSection />
      <DeerVoteSection />
      <DeerTrailSection />
      <ContractSection />
      <FooterSection />
    </main>
  );
}
