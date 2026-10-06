# Explore

Explore develops several art directions from one brief, then generates individual images for comparison. It lives next to Preview and Style in the node menu.

## First run

Write a brief, optionally connect assets, and click Explore. Defaults are nine directions, one image each, OpenAI Image 2.5 Flare, medium quality, 2K and 16:9. A new node falls back to an enabled model and its supported format if necessary; saved selections are not silently changed. Settings offer task, style family, creative range, reference influence, Grade, image model, format and direction count (one to 25).

Grade uses the same named presets as Style, defaulting to None. It guides both planning and image generation without changing product/character identity or explicit brand colors. The selected image's direction details include the grade used for that image. Custom palettes remain available through a connected Style node. Changing future settings does not modify old images or their saved prompts.

Auto interprets the brief. Photographic work uses cinematic/editorial craft; logos and other graphic work use graphic design criteria rather than forcing a photographic film treatment.

## References

- Image / Product: preserve the supplied object, its identity and branding.
- Character: use the locked, selected non-base Character sheet.
- Mood Board: borrow visual treatment, not its depicted subjects or collage layout.
- Style and Camera: use their existing hidden prompts where appropriate to the medium.

Up to eight image references are supported, including parent images when branching, subject to the selected model’s lower limit (for example, five for Ideogram). Reference Influence changes how freely mood references are interpreted, not how faithfully an identity or product must be kept.

References has its own collapsible section, independent of Settings. Each input has a connected-source description box. When collapsed, typed connection handles remain visible while descriptions are hidden. Collapsing never changes the underlying connections or their types.

## Develop a direction

Select an image to make it the active output. Double-click opens the standard image viewer. A star saves a favorite in this node.

- More Like This reuses the selected direction without a new planning call.
- Push Further develops a bolder child direction.
- Refine applies a written adjustment.
- Check two results and use Combine to describe which qualities to take from each.
- Direction Details shows the concept, reusable style brief and image prompt.

New images append to a compact horizontal thumbnail strip. Removing a result removes it from this node only; the local file and History remain. **Images output** is Explore's only output. Connect it to Preview to browse the entire collection at full resolution, retaining direction names. Connecting it to other image inputs uses the selected image.

## Cost and recovery

Planning uses the existing OpenAI creative-model provider routing. Image generation uses the existing image providers, output storage and History/Stats. API Cost visibility follows Workspace settings. Planning is billed separately, so the full exploration price is variable; More Like This can show the existing image estimate.

Images run sequentially. Stop lets the submitted image finish and leaves the rest unsubmitted. Resume uses the saved plan, references and original image settings, not newly edited settings. Successful siblings are never repeated by Resume. Interrupted requests are not automatically retried: check History and the provider first, since the request may still finish and be billed.

New runs generate one image per direction, and More Like This adds one image. New and resumed batches support up to 25 images.

## Maintenance

Prompt rules, request construction and result normalization live in `src/explore.js`; provider-independent orchestration in `src/nodeRunners/explore.js`; planning route in `server/routes/explore.js`; UI in `src/components/ExploreNodeBody.jsx`. Update these rules and `test/explore.test.js` together. The `e2e/explore.spec.js` browser tests use mocked providers and bundled media, never paid generations.
