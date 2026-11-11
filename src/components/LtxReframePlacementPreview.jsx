import React from "react";
import { displayMediaUrl } from "../mediaAssets.js";
import { defaultOutpaintFrame, outpaintRatio } from "../videoOutpaintFrame.js";
import "./LtxReframePlacementPreview.css";

export default function LtxReframePlacementPreview({ sourceUrl, aspectRatio, anchor }) {
  const [dimensions, setDimensions] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  const ratio = outpaintRatio(aspectRatio);
  let sourceStyle = { visibility: "hidden" };

  if (dimensions) {
    const frame = defaultOutpaintFrame(dimensions, aspectRatio);
    const width = 100 / frame.width;
    const height = (width * ratio * dimensions.height) / dimensions.width;
    const x = anchor.includes("left") ? 0 : anchor.includes("right") ? 1 : 0.5;
    const y = anchor.includes("top") ? 0 : anchor.includes("bottom") ? 1 : 0.5;
    sourceStyle = {
      width: `${width}%`, height: `${height}%`,
      left: `${Math.max(0, 100 - width) * x}%`, top: `${Math.max(0, 100 - height) * y}%`,
    };
  }

  return (
    <figure className="ltx-reframe-preview" aria-label="Reframe placement preview">
      <div className="ltx-reframe-preview-frame" style={{ "--reframe-ratio": ratio }}>
        {sourceUrl && <video
          aria-label="Source video"
          src={displayMediaUrl(sourceUrl)}
          muted
          playsInline
          preload="auto"
          style={sourceStyle}
          onLoadedMetadata={({ currentTarget: { videoWidth, videoHeight } }) => {
            if (videoWidth && videoHeight) setDimensions({ width: videoWidth, height: videoHeight });
          }}
          onError={() => { setFailed(true); setDimensions(null); }}
        />}
      </div>
      <figcaption>
        {failed ? "Could not preview the source video."
          : !sourceUrl ? "Connect a source video to preview placement."
          : !dimensions ? "Loading source video…"
          : `${aspectRatio} output · striped area shows space to fill`}
      </figcaption>
    </figure>
  );
}
