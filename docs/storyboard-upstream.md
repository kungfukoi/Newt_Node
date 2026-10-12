# Storyboard upstream comparison

Checked 2026-10-12 against SugerMilks/NewtNode main at `8104597` (2026-10-06).
The latest dedicated storyboard update is `36567bf` (2026-09-28).

The earlier local implementation already had selected revisions, protected panels,
bounded image version history, Balanced/Deep/Off QC, spatial continuity checks,
automatic combined-board output, and direct frame/PDF exports.

This update imports the current upstream directing skill 2.2.0, independent
planner, cast validation and bounded correction, prompt policy, shot/action-state
contracts, reference-image analysis cache, and QC engine. Upstream image prompt,
reference-map, review-prompt, and selection controls are used in the local editor.
Auto panel count, approach, pacing and duration guidance feed the new planner.
Cast fingerprints invalidate hidden staging after manual edits. Generation and
QC receive the correctly ordered visible character identity sheets. Generate
Missing preserves completed panels; selected regeneration uses current directions.
New plans require confirmation before replacing existing work. Panel details are
collapsed in the gallery, and idle panels remain editable during another render.

Compatibility adaptations:

- Director input and its original planner remain supported. Upstream removes
  Director input and migrates boards into independent scenes. We retain the
  connection and cut/keyframe validation to preserve our documented workflow.
- Existing uploaded/prepared characters remain available. Connected Character
  inputs also work with standard monochrome rendering.
- New planning uses `/api/node/storyboard-plan-v2`; new revisions and sequence
  review use versioned endpoints alongside the original saved-client contracts.
- Existing provider routing, model labels, version snapshots, managed assets,
  output propagation, stale-review notices, and paid usage records are preserved.
- The storyboard model list adds upstream Seedream 5 Pro while retaining our
  supported model choices. Our shared generation runner owns provider settings.

This is an upstream port with compatibility adapters, not a whole-repository merge.
No commit, branch change, push, or paid generation is part of this update.
