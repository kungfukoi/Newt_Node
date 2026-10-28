import React from "react";
import { Film } from "lucide-react";
import { displayMediaUrl, videoPosterUrl } from "../mediaAssets.js";

// Result galleries are selectors, not players. Never allocate a video decoder
// for each saved clip; selection/drag payloads remain owned by the parent.
export default function VideoThumbnail({ item }) {
  const src = displayMediaUrl(videoPosterUrl(item));
  const [failed, setFailed] = React.useState("");
  return src && failed !== src
    ? <img src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setFailed(src)} />
    : <span className="preview-thumb-model" aria-hidden="true"><Film size={22} /></span>;
}
