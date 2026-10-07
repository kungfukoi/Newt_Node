import React from "react";
import { isFlux3Model, flux3OutputFormatOptions } from "../flux3.js";
import { isIdeogram45Model, ideogram45QualityOptions, ideogram45EditQualityOptions, ideogram45EditPrecisionOptions, ideogram45SizeOptions } from "../ideogram45.js";

export default function ImageModelAdvancedOptions({ node, onUpdate, referenceCount, Row }) {
  const flux = isFlux3Model(node.data.model);
  if (!flux && !isIdeogram45Model(node.data.model)) return null;
  const key = flux ? "flux3Options" : "ideogram45Options";
  const options = node.data[key] || {};
  const update = patch => onUpdate(node.id, { [key]: { ...options, ...patch } });
  const edit = referenceCount > 0;
  const qualities = edit ? ideogram45EditQualityOptions : ideogram45QualityOptions;
  const sourceSize = edit && (options.editPrecision === "high" || options.preserveSourceSize);
  const toggle = (label, field, disabled = false) => (
    <Row label={label}>
      <input type="checkbox" aria-label={label} checked={disabled || Boolean(options[field])} disabled={disabled}
        onChange={event => update({ [field]: event.target.checked })} />
    </Row>
  );
  return <>
    {!flux && <Row label="Quality">
      <select aria-label="Ideogram quality" value={qualities.includes(options.quality) ? options.quality : "high"} onChange={event => update({ quality: event.target.value })}>
        {qualities.map(value => <option key={value} value={value}>{value === "very_low" ? "Very Low" : value[0].toUpperCase() + value.slice(1)}</option>)}
      </select>
    </Row>}
    {(flux || !edit) && toggle("Prompt Expansion", "enablePromptExpansion")}
    {flux ? <>
      <Row label="Output Format">
        <select aria-label="Flux output format" value={options.outputFormat || "png"} onChange={event => update({ outputFormat: event.target.value })}>
          {flux3OutputFormatOptions.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}
        </select>
      </Row>
      <Row label="Safety Tolerance">
        <input className="model-option-input" aria-label="Flux safety tolerance" type="number" min="0" max="4" step="1" value={options.safetyTolerance ?? 2}
          onChange={event => update({ safetyTolerance: Number(event.target.value) })} />
      </Row>
      <Row label="Model Version">
        <input className="model-option-input" aria-label="Flux model version" value={options.version ?? "latest"} onChange={event => update({ version: event.target.value })} />
      </Row>
    </> : <>
      <Row label="Seed">
        <input className="model-option-input" aria-label="Ideogram seed" type="number" step="1" placeholder="Random" value={options.seed ?? ""} onChange={event => update({ seed: event.target.value })} />
      </Row>
      {edit && <>
        <Row label="Edit Precision">
          <select aria-label="Ideogram edit precision" value={options.editPrecision || "regular"} onChange={event => update({ editPrecision: event.target.value })}>
            {ideogram45EditPrecisionOptions.map(value => <option key={value} value={value}>{value === "high" ? "High" : "Regular"}</option>)}
          </select>
        </Row>
        {toggle("Preserve Source Size", "preserveSourceSize", options.editPrecision === "high")}
      </>}
      {!sourceSize && <Row label="Exact Image Size">
        <select aria-label="Ideogram image size" value={options.imageSize || ""} onChange={event => update({ imageSize: event.target.value })}>
          <option value="">Automatic</option>
          {ideogram45SizeOptions.map(value => <option key={value} value={value} disabled={edit && value.split("x").some(dimension => Number(dimension) % 32 !== 0)}>{value.replace("x", " x ")}</option>)}
        </select>
      </Row>}
    </>}
  </>;
}
