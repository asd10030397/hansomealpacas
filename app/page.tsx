import { AboutSection } from "@/sections/AboutSection";
import { ContractSection } from "@/sections/ContractSection";
import { DeerVoteSection } from "@/sections/DeerVoteSection";
import { FooterSection } from "@/sections/FooterSection";
import { HeroSection } from "@/sections/HeroSection";
import { ReactionSection } from "@/sections/ReactionSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AboutSection />
      <DeerVoteSection />
      <ReactionSection />
      <ContractSection />
      <FooterSection />
    </main>
  );
}
