# Utility · CorridorKey 2.0

Choose **Utility → Video → CorridorKey 2.0**. CorridorKey is no longer a separate catalog node. Saved `keyer` nodes migrate to Utility while retaining their node IDs, ports, results, hints and settings. Switching Utility video models preserves the source and main-output connection where compatible; unsupported auxiliary connections are removed. Extract Frame, Wan VACE Mask-to-Video and Wan VACE 14B Inpainting are retired Utility selections: their saved results remain viewable, but their runs are disabled. Timeline frame extraction and Wan 2.2 VACE Inpainting remain available.

Keyer runs an independently installed CorridorKey 2.0 Python engine on the local NVIDIA GPU. It does not use a hosted provider, install weights, or switch to another keyer. The current integration accepts display-coded sRGB/Rec.709 video. Convert camera log, ACES, PQ or HLG upstream; this node does not provide HDR/EXR ingest or output.

## Setup

Install the official [CorridorKey 2.0 engine](https://github.com/nikopueringer/CorridorKey2.0) and all foundation weights. Its published requirements are an RTX 30-series or newer NVIDIA GPU, CUDA-enabled PyTorch, and FFmpeg. Apple GPU inference is not supported by this integration.

Set these local server environment variables, or add them to the ignored `.env` file:

```
NEWTNODE_CORRIDORKEY_ROOT=C:/tools/CorridorKey2.0
# Optional when the engine's Python is outside its venv:
# NEWTNODE_CORRIDORKEY_PYTHON=C:/tools/CorridorKey2.0/venv/Scripts/python.exe
```

On Linux use the engine's absolute path; the default Python is `venv/bin/python`. Windows uses `venv/Scripts/python.exe`. Restart the Newt Node backend after configuration, once active generations have finished. The node's Refresh button checks installation files; a successful key confirms runtime/CUDA availability. Missing dependencies or unsupported hardware produce explicit errors.

## Node workflow

The **Video** disclosure sits immediately above Model. Close it to hide the viewer and configuration and shorten the node; input/output handles and Run remain available. Its open/closed state is saved with the node, independently of the nested Settings disclosure.

1. Add **Utility**, choose **Video**, and select **CorridorKey 2.0**. Connect a Video node or another video-producing node to Source video. All source footage and matte hints enter through input ports; there is no upload/file picker or hidden uploaded-source fallback.
2. Start with Automatic mode. For difficult shots choose First-frame matte and connect a PNG/JPEG black-and-white matte, or Full matte video and connect a matching video matte. White selects the subject; black selects the background. Full hints must match source size, frame rate and duration.
3. Adjust despill (0–1). Hint trust controls conditioning, not mask feathering. Carry matte through time uses upstream temporal carry. Auto memory uses upstream VRAM selection; smaller windows trade context for memory. Test frames limits processing to the first N frames; 0 keys the entire clip.
4. Run Keyer. The viewer switches between Source, Checker, Matte, Foreground and Cutout. The carousel selects prior runs; output ports always follow the selected run regardless of the viewer tab. Settings changes do not rewrite old results.
5. Connect Cutout to Preview, Composite or Output; Matte and Foreground are separate video ports. Composite can use the Matte video as an explicit mask. Default Output copies the original master. Converting Cutout to H.264/MP4 drops alpha.

Cutout is an sRGB ProRes 4444 MOV with straight/unpremultiplied alpha. Matte and foreground are display-referred H.264 10-bit 4:4:4 videos, not EXR masters. Despill applies to Cutout and Checker; Foreground remains the raw prediction. The engine writes silent video; source audio is not included. A higher precision container does not recover absent source precision.

Only one Keyer job runs per backend. Progress labels report upstream stages/windows, without invented percentages. The browser polls the job; Reconnect to previous key resumes tracking without launching another inference. Jobs are held in memory (up to 50 completed records); a server restart loses tracking. Completed outputs remain in History and workflow assets. After an interruption, inspect History before starting another key. Temporary inference files are removed after completion/failure. There is a one-hour process limit.

The primary Cutout uses the existing managed Output target; auxiliary passes are managed dependencies. Result metadata stores pass URLs, source and hint URLs, and settings so Save As/packaging can relocate them. Engine paths and weights remain machine-local. History records a local GPU run with zero provider charge; electricity/hardware costs are excluded.

## Upstream licensing

This adapter invokes the user's separate installation. No CorridorKey source or weights are bundled. Review the upstream [license](https://github.com/nikopueringer/CorridorKey2.0/blob/master/LICENSE) before distribution: the project specifically directs commercial software integrations to contact Corridor Digital. Its license also restricts paid inference services and redistribution, and has seat requirements for organizations above its revenue threshold. The individual foundation model licenses also apply. Local evaluation is separate from permission to ship a bundled product.
