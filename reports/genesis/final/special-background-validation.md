# HANSOME Genesis — Special Background Class-Lock Validation

_Gameplay Class ↔ Special Background lock. Special 21 only; public pipeline untouched._

## Class-lock map

| Gameplay Class | Locked Background |
|---|---|
| King | king |
| Guardian | guardian |
| Farmer | farmer |
| Lucky | lucky |
| Runner | runner |

## Checks

| Check | Result | Detail |
|---|---|---|
| Special backgrounds excluded from public random pool | PASS ✅ | 5 special ids absent from background.items |
| Special backgrounds flagged excludeFromRandomPool | PASS ✅ | true |
| All special items status = special-reserved | PASS ✅ | special-reserved/special-reserved/special-reserved/special-reserved/special-reserved |
| All 5 special background PNGs present | PASS ✅ | 5/5 |
| Class-lock map consistent (traits.json ↔ compatibility.json) | PASS ✅ | {"King":"king","Guardian":"guardian","Farmer":"farmer","Lucky":"lucky","Runner":"runner"} |
| No Public/Common NFT uses a special background | PASS ✅ | 470 public scanned, 0 violations |
| Special-21 tokens obey class-lock (where assigned) | PASS ✅ | 0 special tokens carry a class/bg so far, 0 lock errors |
| Class-lock rule self-test (5 cases) | PASS ✅ | all pass |

**Overall: ALL CHECKS PASSED ✅**

> The Special 21 (Founder #001 + 20 Legendary) are still artwork-pending; once each is assigned a `gameplayClass` + `specialBackground`, this validator enforces the lock automatically. `validateSpecialToken()` is exported for the future Special-21 generator.
