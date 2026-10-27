# Kling 4.0 Image-to-Video

Select **Kling 4.0 Image-to-Video** in Video or a Video Model node. Enable it
in Settings's model preferences, select **Fal** or **Atlas Cloud** under
Model Providers > Video Model, and select an active credential for that provider.
An unsupported provider or missing selected key fails without switching providers.
Existing Kling O3 models and saved workflows retain their identities.

Connect exactly one Start Frame, optionally one End Frame, and up to eight
Middle Images (the node's existing `referenceImageIn` port). Middle images follow
connection order; repeated images retain their positions. Frames must be managed
PNG/JPEG images, at least 300 pixels on each side, at most 30 MB, with aspect
ratios between 2:5 and 5:2. Describe motion in the prompt.

Duration is 3–30 whole seconds. Aspect ratio follows the images. Both providers
support native 720p/1080p. Atlas also supports `1080p-esr`, `2k-esr` and `4k-esr`;
these are enhanced output, with additional provider processing and billing.
Changing to Fal preserves a saved ESR selection visibly but rejects it until a
supported resolution is selected. Director, Character, video/audio references,
seed, prompt strength and negative-prompt controls are not exposed for this route.
The schemas expose no audio-generation control; returned audio is retained as
delivered by the provider. Saved legacy audio preferences do not alter the request.

The shared batch runner, result selection, Preview/Output and managed downloads
apply. History retains provider, endpoint, prompt, duration, resolution, frame
sources/counts and output metadata. Stats records selected-provider identity and
credential attribution through the existing accounting path. Atlas runtime quotes
and Fal request charges are used when available; otherwise the run is explicitly
unpriced. No Kling O3 rate is reused. Foreground tracking reports provider progress;
this route does not add durable cloud-job recovery. Check provider history after
an interrupted submission before rerunning.

Provider schemas checked October 27, 2026:

- [Fal image-to-video](https://fal.ai/models/kling/v4/image-to-video/api):
  `kling/v4/image-to-video`, `start_image_url`, `middle_image_urls`, `end_image_url`.
- [Atlas model](https://www.atlascloud.ai/models/kwaivgi/kling-v4.0/image-to-video)
  and [schema](https://static.atlascloud.ai/model/schema/kwaivgi-kling-v4.0-image-to-video.json):
  `kwaivgi/kling-v4.0/image-to-video`, `image`, `middle_images`, `last_image`.

Local tests mock provider submissions; no paid generation is required or performed.
