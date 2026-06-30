# feat: Logging, Allowance Management, React Hooks SDK, and Native XLM Funding

**Branch:** `feat/logging-allowance-hooks-xlm-492-493-494-504`
**Base:** `main`

Closes #492
Closes #493
Closes #494
Closes #504

---

## Summary

This PR resolves four SDK issues from the Stellar Wave program in a single cohesive change. All four features build on the same core infrastructure (the `ContractClient`, logger, and provider), so shipping them together avoids redundant churn.

---

## What changed

### Issue #492 — Improved Logging and Debugging

**Files:** `lib/stellar/contract.ts`, `components/StellarGrantsProvider.tsx`

- `ContractClient` now accepts a custom `ILogger` via its constructor config — pass your own logger or leave it unset to use the built-in `Logger` (already existed, now wired in).
- `simulateView` logs the outgoing XDR, raw RPC response, and decoded result at `debug` level.
- `buildWriteXdr` logs the method, caller, and produced XDR at `debug` level.
- `StellarGrantsProvider` accepts a `logger` prop (any `ILogger`) and exposes the active config as `ctx.config` (`logLevel`, `debug`, `logger`).
- A new exported `StellarGrantsSDKConfig` interface makes provider configuration typed.
- By default the SDK remains silent in production (`logLevel: "warn"`); set `debug={true}` on the provider or `NEXT_PUBLIC_SDK_DEBUG=true` to enable verbose output.

### Issue #493 — Token Allowance Management

**Files:** `lib/stellar/contract.ts`

Three new methods on `ContractClient`:

| Method | What it does |
|---|---|
| `getAllowance(tokenAddress, owner, spender)` | Simulates the SAC `allowance` view call; returns `0n` for native XLM (no allowance concept). |
| `setAllowance(tokenAddress, amount, owner, spender)` | Builds the unsigned XDR for an SAC `approve` call; returns `null` for native XLM. Approval expires ~1 day (ledger-based). |
| `ensureAllowance(tokenAddress, requiredAmount, owner, spender)` | Checks the current allowance and returns the approve XDR only if it's insufficient — otherwise `null`. |

Native XLM (`"native"` sentinel or SAC contract ID) short-circuits all three methods so callers never need to branch on token type.

Two utility functions exported from `contract.ts` and re-exported from `lib/stellar/index.ts`:
- `isNativeXlmAddress(tokenAddress)` — detection helper.
- `getNativeXlmContractId(networkPassphrase?)` — derives the XLM SAC ID from the network passphrase.

### Issue #494 — React Hooks for StellarGrants SDK

**Files:** `components/StellarGrantsProvider.tsx`, `hooks/index.ts`

- `StellarGrantsProvider` context now includes a `sdk: StellarGrantsSDK` field — the high-level search/filter/sort class. Call `sdk.hydrate(grants)` after fetching grant data to enable all helpers.
- `hooks/index.ts` upgraded to a full public API surface:
  - JSDoc dashboard example at the top of the file.
  - All hook return types re-exported (`UseFundGrantReturn`, `GrantDetailData`, etc.).
  - `StellarGrantsProvider`, `StellarGrantsProviderProps`, `StellarGrantsContextValue`, and `StellarGrantsSDKConfig` re-exported so consumers can import everything from `@/hooks`.

The existing `useStellarGrants()`, `useGrant(grantId)`, `useMyGrants()`, and `StellarGrantsProvider` were already implemented and are unchanged in behaviour — this issue wraps them into a cohesive SDK surface.

### Issue #504 — Support for Native XLM Funding

**File:** `lib/stellar/xlm-native.ts` (new), `lib/stellar/index.ts`

New module with clean, transparent native XLM funding paths:

| Export | Purpose |
|---|---|
| `isNativeXlm(tokenAddress)` | Detects `"native"` sentinel or the computed XLM SAC contract ID. |
| `getNativeXlmSacId(networkPassphrase?)` | Derives the SAC contract ID for XLM on any network. |
| `resolveTokenAddress(tokenAddress)` | Converts `"native"` to its SAC ID; passes other addresses through. |
| `computeRequiredBalance(amountStroops)` | Returns `{ totalRequired, totalRequiredXlm }` including a 0.01 XLM fee buffer and 1 XLM base reserve. |
| `getWalletXlmBalance(address)` | Fetches the wallet's native XLM balance in stroops; returns `0n` on error. |
| `checkXlmSufficiency(address, amount)` | Combines balance fetch + required computation into `{ sufficient, balance, required }`. |
| `buildNativeXlmFundXdr(params)` | Builds a **two-operation transaction**: (1) approve the XLM SAC allowance for the grant contract, (2) call `grant_fund` using the XLM SAC address as the token. No manual wrapping required. |

Constants: `STELLAR_BASE_RESERVE_STROOPS` (10 000 000 = 1 XLM), `TX_FEE_BUFFER_STROOPS` (100 000 = 0.01 XLM).

---

## Tests

30 new tests across 4 files — all pass:

| File | Tests | Covers |
|---|---|---|
| `tests/lib/logger-contract.test.ts` | 4 | Logger injection, validation error paths, native XLM skip |
| `tests/lib/allowance.test.ts` | 9 | `isNativeXlmAddress`, `getAllowance`, `setAllowance`, `ensureAllowance` |
| `tests/lib/xlm-native.test.ts` | 12 | `isNativeXlm`, `resolveTokenAddress`, `computeRequiredBalance`, `checkXlmSufficiency`, `getWalletXlmBalance` |
| `tests/hooks/useStellarGrants.test.tsx` | 5 | Provider context shape, SDK instance, debug config, hydrate + search E2E |

> **Note on pre-existing failures:** Two tests (`contract-approveToken.test.ts` — expects `/Not implemented/` but network returns `Bad Request`; `MilestoneProof.test.tsx` — loading shimmer assertion) were failing on `main` before this branch and are unrelated to these changes. Verified with `git stash` before/after comparison.

---

## How to review

```bash
git fetch origin feat/logging-allowance-hooks-xlm-492-493-494-504
git checkout feat/logging-allowance-hooks-xlm-492-493-494-504

# Run new tests only
cd stellargrant-fe
node_modules/.bin/vitest run tests/lib/logger-contract.test.ts tests/lib/allowance.test.ts tests/lib/xlm-native.test.ts tests/hooks/useStellarGrants.test.tsx
```

Enable debug logging in any component:
```tsx
<StellarGrantsProvider debug={process.env.NODE_ENV !== "production"}>
  <App />
</StellarGrantsProvider>
```

Check allowance before funding:
```ts
const xdr = await client.ensureAllowance({
  tokenAddress: "CUSDC...",
  requiredAmount: 10_000_000n,
  owner: walletAddress,
  spender: CONTRACT_ID,
});
if (xdr) await signAndSubmit(xdr); // only if approval needed
```

Fund with native XLM:
```ts
import { checkXlmSufficiency, buildNativeXlmFundXdr } from "@/lib/stellar/xlm-native";

const { sufficient, required } = await checkXlmSufficiency(walletAddress, 50_000_000n);
if (!sufficient) throw new Error(`Need ${required.totalRequiredXlm} XLM`);

const xdr = await buildNativeXlmFundXdr({ grantContractId, grantId: 1n, amountStroops: 50_000_000n, funder: walletAddress });
await signAndSubmit(xdr);
```
