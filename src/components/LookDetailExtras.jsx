import React from "react";
import { Palette } from "lucide-react";
import { displayMediaUrl } from "../mediaAssets.js";
import { styleLibraryApi } from "../api/newtApi.js";

export default function LookDetailExtras({ style, onOpenLook }) {
  const colours = style.colours || [], similar = style.similarStyles || [];
  return <div className="look-detail-extras">
    <section aria-label="Look colours"><h3>Colours</h3>
      {colours.length ? <><div className="look-colour-bar" aria-hidden="true">{colours.map(colour => <span key={`${colour.name}-${colour.hex}`} style={{ backgroundColor: colour.hex, flexGrow: colour.percent || 1 }}/>)}</div><ul className="look-colour-list">{colours.map(colour => <li key={`${colour.name}-${colour.hex}`} title={colour.hex}><i style={{ backgroundColor: colour.hex }} aria-hidden="true"/><span>{colour.name}</span>{colour.percent != null && <small>{colour.percent}%</small>}</li>)}</ul></> : <p className="library-muted">No colour palette is available in this look’s catalog data yet.</p>}
    </section>
    <section aria-label="Similar styles"><h3>Similar styles</h3>
      {similar.length ? <div className="look-similar-grid">{similar.map(look => { const image = look.examples?.[0]; return <button type="button" key={look.id} aria-label={`View similar look ${look.name}`} onClick={() => onOpenLook({ ...look, catalog: true })}>{image ? <img src={image.localUrl ? displayMediaUrl(image.localUrl) : styleLibraryApi.catalogAssetUrl(image.url)} alt="" loading="lazy"/> : <span className="look-similar-placeholder"><Palette size={25}/></span>}<span>{look.name}</span></button>; })}</div> : <p className="library-muted">No similar styles are available in this look’s catalog data yet.</p>}
    </section>
  </div>;
}
