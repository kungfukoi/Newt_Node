export function outpaintPlatePreview(item) {
  const details = item?.videoOutpaint;
  if (!details || details.localCrop) return null;
  if (details.matching?.generatedPlateUrl) return { url: details.matching.generatedPlateUrl, rate: 1, offset: 0, label: "Generated plate preview" };
  if (!details.rawVideoUrl) return null;
  const plan = details.prepared?.plan;
  const providerFps = Number(plan?.fps);
  const fraction = String(plan?.sourceFrameRate || "").split("/").map(Number);
  const sourceFps = fraction.length === 2 && fraction[1] > 0 ? fraction[0] / fraction[1] : Number(plan?.sourceFps || providerFps);
  const all = details.matching?.repeatOutput === "all";
  const first = all ? 0 : Number(plan?.prerollFrames || 0) + Number(details.matching?.temporalAlignment?.offsetFrames || 0);
  return { url: details.rawVideoUrl, rate: providerFps > 0 && sourceFps > 0 ? sourceFps / providerFps : 1, offset: providerFps > 0 ? Math.max(0, first / providerFps) : 0, label: "Raw generated plate preview" };
}

// Project the selected view onto an ordinary video item without rewriting the
// retained generation. Finishing metadata belongs to the composite, not the plate.
export function outpaintOutputItem(item, showComposite = true) {
  const plate = !showComposite && outpaintPlatePreview(item);
  if (!plate) return item;
  const fileName = plate.url.split("/").pop().split(/[?#]/)[0];
  return {
    url: plate.url, type: "video", label: plate.label.replace(/ preview$/, ""),
    fileName, mimeType: /\.mov$/i.test(fileName) ? "video/quicktime" : /\.webm$/i.test(fileName) ? "video/webm" : "video/mp4",
    originResultUrl: item.url,
    outpaintOrigin: item.videoOutpaint
  };
}
