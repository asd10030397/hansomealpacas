import { AboutSection } from "@/sections/AboutSection";
import { ContractSection } from "@/sections/ContractSection";
import { FooterSection } from "@/sections/FooterSection";
import { HeroSection } from "@/sections/HeroSection";
import { ReactionSection } from "@/sections/ReactionSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AboutSection />
      <ReactionSection />
      <ContractSection />
      <FooterSection />
    </main>
  );
}
