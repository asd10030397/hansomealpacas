# HANSOME Documentation Structure

| Field | Value |
|------|------|
| Document ID | `DOC-STRUCTURE` |
| File | `docs/PROJECT_DOCUMENTATION_STRUCTURE.md` |
| Traditional Chinese mirror | `docs/PROJECT_DOCUMENTATION_STRUCTURE_zh-TW.md` |
| Version | `1.0.0` |
| Status | Approved |
| Scope | Documentation architecture only |
| Does not define | Gameplay rules, NFT art assets, economic formulas, or implementation code |

---

## Table of Contents

1. [Purpose](#purpose)
2. [Source of Truth](#source-of-truth)
3. [Official Document Map](#official-document-map)
4. [1. Core Game Rules](#1-core-game-rules)
5. [2. Security & Fair Play](#2-security--fair-play)
6. [3. Mathematical & Economic Verification](#3-mathematical--economic-verification)
7. [4. NFT Design Bible](#4-nft-design-bible)
8. [5. Project Roadmap](#5-project-roadmap)
9. [6. Development Bible](#6-development-bible)
10. [Companion / Legacy Documents](#companion--legacy-documents)
11. [Versioning Policy](#versioning-policy)
12. [Document Lifecycle](#document-lifecycle)
13. [Cross-Reference Rules](#cross-reference-rules)
14. [Maintainer Checklist](#maintainer-checklist)
15. [Documentation Principles](#documentation-principles)
16. [Change Log](#change-log)

---

## Purpose

This document defines the **overall documentation architecture** of the HANSOME project.

It specifies:

- every official project document;
- each document’s responsibility and non-responsibility;
- versioning and lifecycle rules;
- how future contributors must maintain documentation.

The goal is to **prevent mixing** game rules, NFT design, economics, security analysis, roadmap planning, and implementation standards into a single file.

**This file is not a game rule document.**  
It does not introduce, alter, or reinterpret gameplay, rewards, treasury parameters, or NFT mechanical effects. Existing locked design documents remain the authority for those topics.

---

## Source of Truth

| Concern | Authoritative document class |
|------|------|
| Gameplay, pools, settlement, sinks, emission steps | Core Game Rules (`01_…`) |
| Attacks, fairness, operational security | Security & Fair Play (`02_…`) |
| Invariants, proofs, simulation checklists | Mathematical & Economic Verification (`03_…`) |
| Art, traits presentation, metadata, pipeline | NFT Design Bible (`04_…`) |
| Milestones and sequencing | Project Roadmap (`05_…`) |
| Engineering process and repo hygiene | Development Bible (`06_…`) |
| Documentation layout itself | This file (`PROJECT_DOCUMENTATION_STRUCTURE.md`) |

When two documents appear to conflict:

1. Identify which document **owns** the topic (table above).
2. Treat the owner as authoritative.
3. Fix the non-owner via reference or deletion of duplicated text—**do not** silently fork rules.

Until `01_Core_Game_Rules_v1.1.md` is formally published, the existing bilingual GDS v1.1 pair may serve as the interim gameplay source of truth (see [Companion / Legacy Documents](#companion--legacy-documents)). Publishing `01_…` must be a **faithful extraction** of gameplay only—not a redesign.

---

## Official Document Map

All official documents live under `docs/` unless the Development Bible relocates them with an explicit migration note.

| # | File | Short name | Primary audience |
|---|------|------------|------------------|
| — | `PROJECT_DOCUMENTATION_STRUCTURE.md` | Documentation Structure | All contributors |
| 1 | `01_Core_Game_Rules_v1.1.md` | Core Game Rules | Design, product, future implementers |
| 2 | `02_Appendix_A_Security_and_Fair_Play.md` | Security & Fair Play | Security, design, QA |
| 3 | `03_Appendix_B_Mathematical_and_Economic_Verification.md` | Math & Economy Verification | Economy, auditors, QA |
| 4 | `04_NFT_Design_Bible_v1.0.md` | NFT Design Bible | Art, creative, metadata |
| 5 | `05_Project_Roadmap.md` | Project Roadmap | Leadership, community ops |
| 6 | `06_Development_Bible.md` | Development Bible | Engineers, producers |

Language policy for numbered files:

- Default working language for numbered suite files: **English** (international contributors, auditors).
- Localized mirrors (e.g. Traditional Chinese) are optional and must declare they are translations of a named English version.
- Translations must not invent rules. If translation and English diverge, English (or the explicitly designated master locale for that file) wins after review.

---

## 1. Core Game Rules

### File

`01_Core_Game_Rules_v1.1.md`

### Purpose

The **official game specification**.

Contains **only gameplay** and player-facing systemic rules required to understand how a day of HANSOME is played and settled.

### Must Include

- Game overview
- Treasury (as a game-system concept: rewards come from Game Treasury; no minting)
- Daily flow
- Commit
- Reveal
- Settlement
- Claim
- Maps / locations
- Alpaca abilities
- Cougar abilities
- Reward pools
- Hunting
- Token Sink
- Treasury update rules (including emission step-down as game economy behavior)
- Edge cases

### Must Not Include

- Solidity or other implementation code
- Folder structures, CI, or coding standards
- Art pipeline, palette, or render specs
- Attack catalogs and remediations (link to Appendix A instead)
- Monte Carlo procedures or proof write-ups (link to Appendix B instead)
- Roadmap dates or marketing milestones
- Duplicated long-form security essays

### Rules

- **Locked after release** of the stated version (e.g. v1.1).
- Updated **only** through version upgrades (`v1.2`, `v1.3`, …)—never by silent in-place rule changes while still labeled v1.1.
- **Never** mix implementation notes into this file.
- Parameter tables that define the live game belong here (or are normatively referenced from here with a single canonical table).

### Relationship to GDS

The historical `HANSOME_GDS_v1.1_*.md` documents are comprehensive design freezes.  
`01_Core_Game_Rules_v1.1.md` should become the **lean gameplay extract** aligned with that freeze. Until `01_…` exists, treat GDS v1.1 as interim authority for gameplay.

---

## 2. Security & Fair Play

### File

`02_Appendix_A_Security_and_Fair_Play.md`

### Purpose

Security review and fair-play guidance for the system described by Core Game Rules.

### Must Include

- Commit confidentiality
- Weak salt risks
- Replay protection
- Reveal leakage
- VRF / randomness integrity expectations
- Marketplace risks (including unclaimed rewards transferring with tokens, if applicable under Core Rules)
- Whale behaviour (allowed strategies vs harmful abuse)
- Frontend information leakage
- Off-chain coordination
- Fair play checklist

### Must Not Include

- New gameplay mechanics
- Changes to pool ratios, weights, or trait effects
- Art direction
- Roadmap promises

### Rules

- **Does not modify gameplay.**
- May recommend product, UX, or operational controls.
- If a security finding requires a rule change, the change is proposed against **Core Game Rules** via a new version—not patched only inside this appendix.

---

## 3. Mathematical & Economic Verification

### File

`03_Appendix_B_Mathematical_and_Economic_Verification.md`

### Purpose

Verify every mathematical invariant implied by Core Game Rules.

### Must Include

- Token supply invariant
- Reward conservation
- Treasury conservation
- Farmer normalization checks
- Cougar reward verification
- Integer dust handling expectations
- Extreme cases
- Monte Carlo checklist
- Game theory checklist

### Must Not Include

- New mechanics or “balance patches” disguised as verification
- Implementation code
- NFT visual specifications

### Rules

- **No gameplay changes.**
- **Only verification**, proofs, identities, and test/simulation checklists.
- Formulas cited here must match Core Game Rules; if mismatch is found, Core Rules (or a version bump) are corrected—Appendix B does not become a second rulebook.

---

## 4. NFT Design Bible

### File

`04_NFT_Design_Bible_v1.0.md`

### Purpose

Official **NFT art and collection presentation** specification.

### Must Include

- Collection overview
- Archetypes
- Traits (visual / catalog sense)
- Trait rules (composition, exclusivity for art layers)
- Rarity (presentation and supply counts as creative targets)
- Metadata schema expectations (names, attributes, files)—without contract ABI
- Design philosophy
- Art pipeline
- Review workflow

### Must Not Include

- Game formulas (penalty rates, pool splits, settlement math)
- Smart contract logic
- Emission controller equations

### Rules

- **No game formulas.**
- **No smart contract logic.**
- **Only NFT specifications** (creative + metadata + pipeline).
- When an archetype maps to a gameplay type (e.g. Guardian), state the mapping as a **reference** to Core Game Rules—do not re-derive combat math here.
- Supply counts shown for art planning must remain consistent with Core Game Rules collection sizes unless a versioned design change is approved.

### Version note

Art bible starts at **v1.0** and may iterate independently of Core Game Rules **only** for visual/metadata matters. Any change that alters on-chain trait *mechanical* identity requires a Core Game Rules version discussion.

---

## 5. Project Roadmap

### File

`05_Project_Roadmap.md`

### Purpose

Long-term milestones and sequencing for the project.

### Suggested Structure

```text
Phase 1
  Genesis NFT
      ↓
  Mint
      ↓
  Marketplace
      ↓
  Game Alpha
      ↓
  Public Beta
      ↓
  Season 1
```

Additional phases may be added (Season 2+, governance, expansions) without altering Core Game Rules by themselves.

### Must Not Include

- Normative game formulas
- Binding smart-contract specifications
- “Hidden” rule changes

### Rules

- **Roadmap only.**
- **No technical implementation** deep-dives (those belong in Development Bible or future eng specs).
- Roadmap is **aspirational and not a specification**. Missed dates do not invalidate Core Game Rules.

---

## 6. Development Bible

### File

`06_Development_Bible.md`

### Purpose

Development standards and working agreements for building HANSOME.

### Must Include

- Folder structure
- Naming conventions
- Coding standards
- Asset standards
- Review workflow
- Commit policy
- Version policy (engineering releases vs doc versions)
- Documentation policy (how to update the suite defined here)

### Expected Norms (non-exhaustive)

- Always review before commit.
- Never generate the full NFT collection before review.
- Use incremental review batches.
- Separate gameplay logic from art assets.
- Do not treat roadmap slides as build requirements without a ticket.

### Must Not Include

- Player-facing rule definitions (link to Core Game Rules)
- Final art boards (link to NFT Design Bible)

### Rules

- Process and standards only.
- May reference future implementation, but this Documentation Structure file still forbids treating the Development Bible as a gameplay source of truth.

---

## Companion / Legacy Documents

These files exist in the repository history / `docs/` tree and remain important, but they are **not** substitutes for the six numbered pillars once those pillars are published.

| File | Role |
|------|------|
| `HANSOME_GDS_v1.1_en.md` | Interim full English design freeze (gameplay + systems prose) |
| `HANSOME_GDS_v1.1_zh-TW.md` | Interim Traditional Chinese design freeze (same rules as English GDS) |
| `PROJECT_DOCUMENTATION_STRUCTURE.md` | This architecture index (English) |
| `PROJECT_DOCUMENTATION_STRUCTURE_zh-TW.md` | Architecture index (Traditional Chinese mirror) |
| `CURSOR_AGENT_HANDOFF.md` | Handoff brief for future Cursor / coding agents |
| `../AGENTS.md` | Short root pointer to the handoff |
| `HANSOME_Genesis_Mint_Spec_v1.0.md` | Official single-collection 550 mint (Alpaca + Cougar) |
| `HANSOME_Alpaca_Mint_Spec_v1.0.md` | Alpaca side / Reserved Specials inside Genesis |
| `HANSOME_Cougar_Mint_Spec_v1.0.md` | Cougar identity inside Genesis (not a separate mint) |
| `HANSOME_Contract_Architecture_v1.0.md` | NFT + Game contract architecture (no Solidity) |

### Migration expectation

1. Extract gameplay-only content → `01_Core_Game_Rules_v1.1.md`
2. Extract security-oriented material → `02_Appendix_A_…` (expand with fair-play checklist)
3. Extract identities / verification → `03_Appendix_B_…`
4. Keep GDS files as **archived freeze references** or retire them with a banner pointing to `01_…` after parity review

Do **not** modify locked game rules while splitting documents.

---

## Versioning Policy

### Document version identity

Each official document carries:

- a **file name version** when applicable (`_v1.1`, `_v1.0`);
- an in-document **SemVer-like** or policy version field;
- a **status** (see lifecycle).

### Major / minor document versions (examples)

| Label | Meaning |
|------|------|
| `v1.0` | First approved baseline for that document class |
| `v1.1` | Compatible evolution or correction set within the same generation |
| `v1.2` | Further generation increment; may include rule changes **only** in Core Game Rules |

For **Core Game Rules**, a move from `v1.1` → `v1.2` is the only legitimate way to change locked gameplay after release.

For **NFT Design Bible**, `v1.0` → `v1.1` may cover art/metadata revisions that do not alter mechanical identity.

### Patch versions

| Label | Meaning |
|------|------|
| `v1.1.1` | Typo fixes, clarification, cross-link repairs, formatting—**no** semantic rule change |

If a “patch” would change rewards, traits, or settlement, it is **not a patch**; bump minor/major and run review.

### Engineering vs documentation versions

- Documentation versions describe **specs**.
- Software release tags (when they exist) must reference the documentation versions they implement.
- Mapping is recorded in the Development Bible—not in Core Game Rules narrative text.

---

## Document Lifecycle

Every official document uses one of the following statuses:

| Status | Meaning |
|------|------|
| **Draft** | Work in progress; not authoritative |
| **Review** | Submitted for design/security/art/eng review |
| **Approved** | Accepted by designated owners; may be used operationally |
| **Locked** | Frozen for a named version; edits require a new version or a documented patch with zero semantic change |

### Transition rules

1. `Draft` → `Review` when authors believe content is complete for critique.
2. `Review` → `Approved` after sign-off (owners listed in Development Bible).
3. `Approved` → `Locked` when a version is released to the wider team or public as binding.
4. Changes to a `Locked` Core Game Rules file require **new version file** (e.g. `01_Core_Game_Rules_v1.2.md`) plus deprecation banner on the old file.

### Ownership (logical roles)

| Document | Default owner role |
|------|------|
| Core Game Rules | Game Design Lead |
| Security & Fair Play | Security / Design co-owners |
| Math & Economy Verification | Economy / Design co-owners |
| NFT Design Bible | Art Director |
| Project Roadmap | Project Lead |
| Development Bible | Engineering Lead |
| Documentation Structure | Project Lead + Documentation maintainer |

---

## Cross-Reference Rules

1. **Prefer references over copy-paste.** Quote short invariants if needed; do not maintain two full formula sections.
2. Use stable anchors: document ID + section heading + version.
3. Example reference style:

   > See Core Game Rules v1.1 § Hunting Pool allocation.

4. Appendices may repeat a formula **only** to verify it, and must cite the Core Rules section being verified.
5. NFT Design Bible may list trait *names* and supply counts; mechanical effects link out to Core Game Rules.
6. Roadmap may say “Season 1 launches hunting seasons” without re-specifying penalty coefficients.

---

## Maintainer Checklist

Before merging a documentation PR:

- [ ] Correct pillar file edited (not the wrong neighbor document)
- [ ] No gameplay change slipped into Security, Math, Art, Roadmap, or Dev Bible
- [ ] No art-only change slipped into Core Game Rules
- [ ] Versions and status fields updated
- [ ] Cross-links still resolve
- [ ] Legacy GDS not left as a conflicting silent second rulebook without a banner
- [ ] Patch vs minor/major classification is honest

---

## Documentation Principles

1. **One responsibility per document.**  
   If a section fits two pillars, split it or demote one side to a reference.

2. **Do not duplicate information.**  
   Duplication creates fork risk; forks create unfair games and broken audits.

3. **Prefer references over copy-paste.**  
   Single authoritative statement of each rule.

4. **Gameplay and implementation are separated.**  
   Core Game Rules never become a dumping ground for code style or repo layout.

5. **NFT design is independent from game mechanics.**  
   Visual bibles do not redefine combat or rewards.

6. **Security documentation never changes gameplay.**  
   It constrains how we protect the agreed game.

7. **Mathematical verification never introduces new mechanics.**  
   It only checks the mechanics we already agreed.

8. **Roadmap is aspirational and not a specification.**  
   Timing failure is a planning issue, not a rules exploit.

9. **Locked means locked.**  
   Clarifications are patches; balance changes are new versions.

10. **Contributors optimize for future implementers.**  
    Clear ownership today prevents ambiguous builds tomorrow—without writing implementation code inside design pillars.

---

## Change Log

| Date | Version | Notes |
|------|------|------|
| 2026-07-17 | 1.0.0 | Initial documentation architecture for the HANSOME suite |

---

**End of document — HANSOME Documentation Structure v1.0.0**
