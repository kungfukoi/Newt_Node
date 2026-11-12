import React from "react";
import { imageEditPoint } from "../imageEdit.js";
import "./mediaCompareDivider.css";

export function MediaCompareDivider({ split, setSplit }) {
  const update = event => {
    setSplit(imageEditPoint(event.clientX, event.clientY, event.currentTarget.parentElement.getBoundingClientRect()).x * 100);
  };
  const release = event => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="ies-compare-handle nodrag nopan" role="slider" tabIndex={0} aria-label="Compare divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} style={{ left: `${split}%` }}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); setSplit(value => event.key === "Home" ? 0 : event.key === "End" ? 100 : Math.max(0, Math.min(100, value + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)))); } }}>
    <span className="ies-compare-grip" aria-hidden="true">↔</span>
  </div>;
}
