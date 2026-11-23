# Dataset packaging model

Supply a snapshot of eligible dataset IDs and explicit package counts to `recommendPackages`. Its caller owns candidate discovery, authorization, the feature flag and the committed search context. Assign a fresh generation to every replacement result, including after an account switch. The adapter uses an injected authenticated transport and requests no 401 replay.

The synthetic fixture models the direct Gateway response from `SearchController.PackageRecommendAsync`. It contains five candidates and one returned package of three. The Gateway can omit a member during enrichment. The response contains no original membership count, so the decoder can validate returned membership only. A returned empty group is visible to the model and cannot be selected. The model preserves the supplied publication date when available.

The selection reducer keeps independent manual and package contributions. On context replacement, pass the manual IDs whose access is still established. On account change, reset the entire selection. Package keys identify a position in a single result. Only dataset IDs can enter a destination payload, and both destinations remain unavailable.

Run the offline suite with `pnpm exec vitest run --config vitest.unit.config.ts src/lib/datasetPackaging`.
