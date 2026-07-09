import { CopyButton } from "@/components/CopyButton";
import { FadeIn } from "@/components/FadeIn";
import { Section } from "@/components/Section";
import { ShareCard } from "@/components/ShareCard";
import { getContractState, getShareState } from "@/lib/launch";

export function ContractSection() {
  const contract = getContractState();
  const share = getShareState();

  return (
    <FadeIn as="section" id="contract">
      <Section ariaLabelledBy="contract-title" className="flex flex-col items-center py-0 text-center">
        <h2
          id="contract-title"
          className="font-[family-name:var(--font-anton)] text-[clamp(2.5rem,8vw,4.5rem)] tracking-[0.1em] text-foreground"
        >
          CONTRACT
        </h2>

        <div className="mt-16 flex flex-col items-center gap-12 sm:mt-20">
          <CopyButton value={contract.address} />
          <ShareCard websiteUrl={share.websiteUrl} contractAddress={share.contractAddress} />
        </div>
      </Section>
    </FadeIn>
  );
}
