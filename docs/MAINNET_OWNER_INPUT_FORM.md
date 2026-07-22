# HANSOME MAINNET — OWNER INPUT FORM

| Field | Value |
|------|------|
| File | `docs/MAINNET_OWNER_INPUT_FORM.md` |
| Purpose | Record explicit project-owner decisions for B3 / B4 / B5 |
| Mode | **Owner decisions only** — does not authorize deploy or transactions |
| Related | [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md) · [`MAINNET_LAUNCH_PROGRESS_TRACKER.md`](./MAINNET_LAUNCH_PROGRESS_TRACKER.md) |

**Hard rules**

- Filling this form does **not** authorize live Mainnet deployment or any transaction.
- Do not invent addresses. Owner supplies checksummed values.
- B3 may be marked **VERIFIED** only after: (1) value inserted into `contracts/.env`, (2) validation passes, (3) acknowledgment recorded here.

---

## A. B3 — VRF Operator

### 1. VRF_OPERATOR

- Full checksummed address:  
  **`0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`**

### 2. 是否核准沿用目前候選地址 `0xcE15…069A`

- [x] Yes，核准沿用
- [ ] No，不核准
- [ ] Not applicable，已提供其他 VRF_OPERATOR

### 3. VRF_OPERATOR_OWNER_ACK

- [x] 1 — 已明確核准
- [ ] 0 — 尚未核准

### Classification (owner)

**Temporary ceremony EOA provider**, not a permanent production-grade VRF solution.

### Approval conditions (owner)

1. This approval applies only to the **VRF_OPERATOR** role used by **VRFRevealAdapter**.
2. This address must not be confused with the Game **RANDOMNESS_PROVIDER** contract or Testnet mock contracts.
3. No deployment or transaction is authorized by this approval alone.
4. The address must be revalidated for checksum, chain, key control, and balance before any live deployment.
5. The project must retain a documented replacement plan for migration to a production-grade VRF or beacon provider.
6. B3 may only be marked **VERIFIED** after the value is inserted, validation passes, and the owner acknowledgment is recorded.
7. B4 and B5 remain unchanged until separately completed.

### Replacement plan (owner)

Replace the temporary ceremony EOA with a production-grade VRF or beacon provider after integration testing, security validation, and explicit project owner approval. Replacement should be prioritized if the EOA key is exposed, signer access changes, fulfillment becomes unreliable, or a supported production VRF becomes available.

### Env values authorized and applied (ops)

```text
VRF_OPERATOR=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A
VRF_OPERATOR_OWNER_ACK=1
```

### B3 form status

| Item | State |
|------|--------|
| Owner decision recorded | **Yes** (2026-07-21) |
| `contracts/.env` insert | **Done** (2026-07-21) |
| Guard validation | **PASS** — `requireMainnetVrfOperator` + `mainnetGuards.unit.ts` (13) |
| Board status | **VERIFIED** (temp ceremony EOA; replacement plan retained) |
| Deploy authorized? | **No** — approval ≠ live ceremony |

注意：

- VRF_OPERATOR 不可為空。
- 不可為 zero address。
- 不可為 `0x0000000000000000000000000000000000000001`。
- 不可為 placeholder、測試地址或未經核准地址。
- 若選擇沿用 `0xcE15…069A`，必須同時勾選核准，且 `VRF_OPERATOR_OWNER_ACK=1`。

---

## B. B5 — Mainnet Owner

### 4. MAINNET_OWNER

- Full checksummed address:  
  **`0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`**

### 5. Owner type

- [ ] Multisig
- [ ] Timelock
- [ ] Cold wallet
- [x] Other: **EOA hot wallet** (initial launch owner)

### 6. Signer count

- Total number of signers: **1**

### 7. Threshold

- Required approvals: **1-of-1**

### 8. Offline backup / recovery note

- Operational launch decision; ownership may be transferred to a multisig or timelock later. Do not record seed phrases or private keys here.

### Env applied (ops)

```text
MAINNET_OWNER=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A
MAINNET_OWNER_ALLOW_CEREMONY_EOA=1
MAINNET_OWNER_OWNER_ACK=1
```

### B5 form status

**Done / board VERIFIED** (2026-07-21) — initial EOA owner recorded and configured. Not multisig/timelock. Deploy not authorized.

---

## C. B4 — RANDOMNESS_PROVIDER go-live acknowledgment

### 9. Temporary ceremony EOA as `RANDOMNESS_PROVIDER`

- Configured address (ops): `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- [x] Owner acknowledges temporary launch use and rotation plan
- [ ] Owner declines / requests different provider

| Field | Value |
|------|------|
| `B4_OWNER_ACK` | `1` |
| `B4_APPROVED_BY` | Project Owner |
| `B4_APPROVAL_DATE` | 2026-07-21 |
| `PROVIDER_STATUS` | temporary |
| `REPLACEMENT_PLAN` | Replace with a decentralized or production-grade randomness provider when available. |

### 10. Signer / date

- Name / role: **Project Owner**
- Date: **2026-07-21**

### B4 form status

**Done / board VERIFIED** (2026-07-21). Deploy not authorized by this acknowledgment alone.

---

## D. Declaration

I am the project owner (or authorized delegate). I understand:

- [x] **B3:** The temporary `VRF_OPERATOR` approval above is recorded.
- [x] **B5:** Initial `MAINNET_OWNER` EOA hot wallet approval is recorded.
- [x] **B4:** Temporary `RANDOMNESS_PROVIDER` acknowledgment is recorded.
- [x] This form alone does **not** authorize Mainnet deploy or any transaction.

| Field | Value |
|------|------|
| Decision date | 2026-07-21 |
| Scope of this update | **Sections A (B3) + B (B5) + C (B4)** |
| Deploy authorized? | **No** |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | B4 owner ack applied — board **VERIFIED**; B1–B6 closed; B7 ceremony next |
| 2026-07-21 | B5 owner decision applied — initial EOA + ACK flags; board **VERIFIED**; B4 still pending |
| 2026-07-21 | B3 env insert + guard validation → board **VERIFIED**; B4/B5 still blank pending owner REMAINING OWNER DECISION |
| 2026-07-21 | Form created; B3 temporary ceremony EOA approved by project owner; B4/B5 left blank |
