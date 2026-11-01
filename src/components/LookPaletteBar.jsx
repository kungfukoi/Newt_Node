import React from "react";

export default function LookPaletteBar({ colours, disabled, onChange }) {
  if(!colours.length)return null;
  return <section className="create-look-colour-palette" aria-label="Extracted colour palette">
    <header><h3>Colour palette</h3><span>Select a colour to refine it</span></header>
    <div className="create-look-colour-bar">{colours.map((colour,index)=>{
      const rgb=colour.hex.slice(1).match(/.{2}/g).map(value=>parseInt(value,16));
      const ink=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>150?"#131313":"#fff";
      return <label key={index} className="create-look-colour-swatch" style={{backgroundColor:colour.hex,color:ink}} title={`${colour.name} · ${colour.hex.toUpperCase()}`}>
        <input type="color" aria-label={`Suggested colour ${index+1}`} value={colour.hex} disabled={disabled} onChange={event=>onChange(index,event.target.value)}/>
        <span>{colour.name}</span><code>{colour.hex.toUpperCase()}</code>
      </label>;
    })}</div>
  </section>;
}
