# Ideogram 4.5

Choose Ideogram 4.5 in image model selectors, or select it under Settings > User Preferences > Image Editor Model for the double-click preview editor. The preview editor does not have its own model picker.

NewtNode uses Fal. Enable an active Fal key. For image generation, select Fal (or the existing Google preference, which only routes Nano Banana Pro to Google); explicit Krea/Atlas routes reject this unsupported model. The editor independently uses Fal for Ideogram regardless of the general image provider preference.

- Text generation: `ideogram/v4.5`, selectable low/medium/high quality (default high), 1K/2K supported sizes.
- Image Model options also expose optional seed, prompt expansion for text generation, and exact supported image dimensions. Reference edits add very-low quality, regular/high edit precision, and source-size preservation. High precision always preserves source geometry. Removing references from a very-low edit uses high text-generation quality. Settings are saved independently from other models; old workflows retain high quality and prompt expansion off.
- Reference edits: `ideogram/v4.5/edit`, primary source followed by up to four references. Excess references are rejected, never truncated.
- Preview editor: high edit precision, source geometry, low/medium/high quality, annotations, sketches, and selected-area removal. Masked edits allow a source plus three references; editor drawings use only one guide reference.
- Masks: black edits and white preserves. Completely selected masks are rejected with an instruction to clear the selection for a whole-image edit. Local compositing preserves unselected pixels.
- Character sheets: 2K. Existing character/model selections retain their defaults.
- History records endpoint, settings, source/reference metadata, and managed local output. Price is explicitly unpriced until a verified Fal rate is configured; no zero-cost claim is made.

API contracts verified October 6, 2026: [generation](https://fal.ai/models/ideogram/v4.5/api), [editing](https://fal.ai/models/ideogram/v4.5/edit/api). Tests use mocked provider responses and do not submit paid requests.
