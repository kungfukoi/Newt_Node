// Builds one planar-RGB graph so every layer retains alpha and its own mask.
export function buildCompositeStackArgs({ layers, width, height, fps, duration, cleanupMask = () => [] }) {
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1"];
  const filters = [`color=c=black:s=${width}x${height}:r=${fps}:d=${duration},format=gbrp[canvas0]`];
  let inputIndex = 0;
  let audioIndex = -1;
  const addInput = (filePath, type) => {
    const index = inputIndex++;
    if (type === "image") args.push("-loop", "1", "-framerate", String(fps));
    args.push("-i", filePath);
    return index;
  };
  layers.forEach((layer, index) => {
    const input = addInput(layer.filePath, layer.type);
    if (audioIndex < 0 && layer.type === "video") audioIndex = input;
    const scale = `setpts=PTS-STARTPTS,fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=bicubic,format=rgba,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1`;
    filters.push(`[${input}:v]${scale},format=gbrap,split=2[layer${index}][alphaSource${index}]`, `[alphaSource${index}]alphaextract[alpha${index}]`);
    let alpha = `alpha${index}`;
    if (layer.maskPath) {
      const mask = addInput(layer.maskPath, layer.maskType);
      const cleanup = [...(layer.invertMask ? ["negate"] : []), ...cleanupMask({ blur: layer.maskBlur, expand: layer.maskExpand })];
      filters.push(`[${mask}:v]${scale},format=gray${cleanup.length ? `,${cleanup.join(",")}` : ""}[mask${index}]`, `[alpha${index}][mask${index}]blend=all_mode=multiply:repeatlast=1[maskedAlpha${index}]`);
      alpha = `maskedAlpha${index}`;
    }
    const mode = { overlay: "hardlight", hardlight: "overlay" }[layer.blendMode] || layer.blendMode;
    const swap = ["softlight", "subtract", "divide"].includes(layer.blendMode);
    const top = swap ? `baseBlend${index}` : `layerRGB${index}`;
    const bottom = swap ? `layerRGB${index}` : `baseBlend${index}`;
    const opacity = (layer.mixAmount / 100).toFixed(6);
    filters.push(
      `[canvas${index}]split=3[baseBlend${index}][baseMix${index}][baseOutput${index}]`,
      `[layer${index}]format=gbrp[layerRGB${index}]`,
      `[${top}][${bottom}]blend=all_mode=${mode}:all_opacity=1:repeatlast=1[blend${index}]`,
      `[blend${index}][baseMix${index}]blend=all_expr=A*${opacity}+B*${(1 - layer.mixAmount / 100).toFixed(6)}:repeatlast=1[mix${index}]`,
      `[mix${index}][${alpha}]alphamerge[masked${index}]`,
      `[baseOutput${index}][masked${index}]overlay=eof_action=repeat:format=auto,format=gbrp[canvas${index + 1}]`
    );
  });
  filters.push(`[canvas${layers.length}]format=yuv420p[out]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[out]");
  if (audioIndex >= 0) args.push("-map", `${audioIndex}:a?`);
  args.push("-t", String(duration));
  return args;
}
