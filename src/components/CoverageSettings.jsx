import React from "react";
import { normalizeCoverageSettings } from "../coveragePresets.js";

export default function CoverageSettings({ node, running, onUpdate, rowComponent: Row, resetOutput }) {
  const settings = normalizeCoverageSettings(node.data);
  const select = (field, label, options) => <Row label={label}><select aria-label={label} value={settings[field]} disabled={running} onChange={event => onUpdate(node.id, { ...resetOutput(), [field]: event.target.value })}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></Row>;
  return <>
    {select("coverageSubject", "Coverage", ["Subject", "Location"])}
    {settings.coverageSubject === "Location" && <>
      {select("coverageLocationType", "Location Type", ["Interior", "Exterior"])}
      {select("coverageExploration", "Explore", ["Stay near reference", "Explore unseen space"])}
      <small title="Nine shooting positions from one reference image. Unseen geography is inferred, not verified.">Scout nine cinematic shots. Unseen areas are inferred.</small>
    </>}
  </>;
}
