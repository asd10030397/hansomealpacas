# HANSOME Wallet Signal Overlap — equal_balance vs shared_funding

| Field | Value |
|-------|-------|
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Chain** | Robinhood · 4663 |
| **Probed** | 2026-07-27 (live Blockscout holders + native funder edges) |
| **Raw probe** | `reports/_wallet-signal-overlap-probe.json` |

## 1. equal_balance_cluster (18)

Identical balance `18000000000000000000000000` (18,000,000 HANSOME):

1. `0xF3B14E3C47d05744A0158091292EB46F880195e2`
2. `0xEa1B9A20341eA76B59ead9A57B718821719ED87A`
3. `0xE6497fA16661F9585850cB7f6D6B64c922C1f3f6`
4. `0xE08d357a63F668A996Aad607be56D06d49E7a678`
5. `0xd4CC3a95b2657aAdB245e7827358716A1661fD1f`
6. `0xCB04Fe852357EB0648A3Eb7a866a9885086091d2`
7. `0xB4F5BCEd1240785F1F38040FC7d1E48F127ae065`
8. `0x9B0147A73E3342Df96Cb5ba6c1805Ff983d1eEE0`
9. `0x92aA743a5CC3904b81a4899BCA0098c690aC49f5`
10. `0x8180cC033B6885DC7DB7AcD1Fc481e0cE489c9Bc`
11. `0x746Baf1337ac73B32Bc3c658D1d1841670590520`
12. `0x66476BaDF50c6A2B0de3D2b208B674C52A84C723`
13. `0x4E566DC6bE59Bc14b6bE9655d86E808BAEccAF61`
14. `0x35f8Ce2d3b4D5b98B5e42406dC7aA54B43D4990C`
15. `0x2aef3DE4D2AD9740927268037aFadE4Fd207938d`
16. `0x255f16e5DC020bE8C092Af6E7BC14632D7b18914`
17. `0x1Da0b323c24b126719a08b4aCB40c6Cd6f64B12F`
18. `0x0a30F6BEC2295340FF6d42D8De8d43e726DF55ED`

## 2. shared_funding_pattern (5)

Common funder `0x45d8d56fA0bEa18CD53eDbCa7523b89Ff89cB58e` → top holders:

1. `0xF3B14E3C47d05744A0158091292EB46F880195e2`
2. `0xEa1B9A20341eA76B59ead9A57B718821719ED87A`
3. `0xE6497fA16661F9585850cB7f6D6B64c922C1f3f6`
4. `0xE08d357a63F668A996Aad607be56D06d49E7a678`
5. `0xd4CC3a95b2657aAdB245e7827358716A1661fD1f`

## 3. Intersection

| Metric | Value |
|--------|-------|
| **Intersection size** | **5** |
| **Coverage of shared set** | **100%** (5/5) |
| **Coverage of equal set** | 27.8% (5/18) |
| **Jaccard** | 0.278 |

All five shared-funding wallets are members of the identical-balance cluster.

## 4. Conclusion

**Same underlying wallet cluster (material overlap).**  
`shared_funding_pattern` is a corroborating view of a subset of the equal-balance cohort, not independent structural evidence.

Soft wording only: probabilistic related-wallet signals — **not** a claim of common ownership.

## 5. Scoring merge rule (applied)

| Rule | Behaviour |
|------|-----------|
| **Primary** | `equal_balance_cluster` (−6) wins when overlap is material |
| **Absorbed** | `shared_funding_pattern` (−5) is **not stacked**; recorded on primary as `mergedFrom: ["shared_funding_pattern"]` |
| **Material overlap** | ≥2 wallets in intersection **and** ≥50% coverage of the smaller set |
| **Independent** | Disjoint / low-overlap wallet sets → both may stack, still under `wallet_relationship` cap 15 |
| **Count-only input** | Empty address lists → overlap unknown → stacking allowed (backward compatible) |

### HANSOME before / after

| | wallet_relationship | Notes |
|--|---------------------|-------|
| **Before** | **11** (−6 + −5) | Double-counted same cluster |
| **After** | **6** (−6 only) | Shared funding absorbed into primary |

Category weights unchanged.
