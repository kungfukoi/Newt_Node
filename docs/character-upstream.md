# Character upstream comparison

Checked 2026-10-12 against SugerMilks/NewtNode main `8104597` (2026-10-06).

Already present: neutral identity masters, separate regular/CU checkpoints,
partial-success recovery, per-wardrobe retries, generated/custom sheet coexistence,
full-sheet wardrobe edits without fixed masks, and obsolete-mask cleanup.

Ported and adapted:

- Standard bases share upstream's charcoal swimwear foundation with opaque chest
  coverage and preserved anatomy/crops. CU guidance treats the original portrait
  as identity authority.
- Wardrobe prompts transfer all referenced wearable accessories, preserve eyewear
  tint and placement, keep distinct goggles/eyewear separate, allow natural
  occlusion, and retain one layered outfit across panels.
- New Characters prefer Nano Banana Pro. Seedream 5.0 Pro uses 2K. Saved model
  choices and legacy defaults remain stable; other supported local models remain.
- Local-only generated/CU sheets survive normalization, selection and reload.
  Managed local URLs take precedence over remote provider URLs. Base/Sheet labels
  keep the existing selection IDs.
- A shared output resolver selects the active full-resolution image or matching CU
  sheet for downstream references, including Storyboard. Modern invalid libraries
  cannot use a stale result; pre-library completed sheets remain supported.
- Character Notes use actual paragraph separators in wardrobe edit requests.

Retained local behavior:

- Stylized design locks and cinematic gray-cyc treatment.
- Character Notes and independently checkpointed generation.
- CU edits use the original portrait and matching completed full Character sheet
  in addition to the CU master and wardrobe, preserving finished-outfit matching.
- Base Identity remains a selectable downstream reference. Upstream instead
  reserves Base sheets for preparation and selects another non-base sheet.
- Full-sheet GPT Image 2.5 routes remain available through supported providers.
  Upstream's Krea mask restriction is not copied into our mask-free wardrobe flow.

Prompt versions are advanced to regular base 3, CU base 6 and wardrobe edit 5.
Saved media remains intact; no paid migration or generation runs on project load.
Verification uses mocked provider calls, reference-order/persistence tests, and
browser integration. No new paid outputs were generated for this comparison.
