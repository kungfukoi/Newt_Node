import React from "react";

export default function LookDetailExtras({ style }) {
  const colours = style.colours || [];
  return <div className="look-detail-extras">
    <section aria-label="Look colours"><h3>Colours</h3>
      {colours.length ? <><div className="look-colour-bar" aria-hidden="true">{colours.map(colour => <span key={`${colour.name}-${colour.hex}`} style={{ backgroundColor: colour.hex, flexGrow: colour.percent || 1 }}/>)}</div><ul className="look-colour-list">{colours.map(colour => <li key={`${colour.name}-${colour.hex}`} title={colour.hex}><i style={{ backgroundColor: colour.hex }} aria-hidden="true"/><span>{colour.name}</span>{colour.percent != null && <small>{colour.percent}%</small>}</li>)}</ul></> : <p className="library-muted">No colour palette is available in this look’s catalog data yet.</p>}
    </section>
  </div>;
}
