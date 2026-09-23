import { model3DNames, model3DOptions } from "./modelOptions.js";

export const rodin25FalEndpoint = "fal-ai/hyper3d/rodin/v2.5";
export const rodin25MaxInputImages = 5;
export const model3DViewOrder = ["front", "back", "left", "right", "top", "bottom", "leftFront", "rightFront"];

export const rodin25MeshOptions = [
  { faceCount: 20000, value: "20K Triangle", label: "20K triangles" },
  { faceCount: 50000, value: "50K Triangle", label: "50K triangles" },
  { faceCount: 150000, value: "150K Triangle", label: "150K triangles" },
  { faceCount: 500000, value: "500K Triangle", label: "500K triangles" },
  { faceCount: 1000000, value: "1M Triangle", label: "1M triangles" },
  { faceCount: 2000000, value: "2M Triangle", label: "2M triangles" }
];

export function normalizeModel3DModel(value) {
  const normalized = String(value || "").trim();
  return model3DOptions.includes(normalized) ? normalized : model3DNames.hunyuanPro;
}

export function isRodin25Model(value) {
  return normalizeModel3DModel(value) === model3DNames.rodin25;
}

export function normalizeModel3DGenerateType(value) {
  return value === "Geometry" ? "Geometry" : "Normal";
}

export function model3DFaceCount(value, model = model3DNames.hunyuanPro) {
  const number = Math.round(Number(value));
  const fallback = 500000;
  if (isRodin25Model(model)) {
    return nearestRodin25MeshOption(Number.isFinite(number) ? number : fallback).faceCount;
  }
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1500000, Math.max(40000, number));
}

export function rodin25QualityMeshOption(value) {
  return nearestRodin25MeshOption(Number(value)).value;
}

export function buildRodin25FalInput({ imageUrls, generateType, enablePbr, faceCount }) {
  const normalizedGenerateType = normalizeModel3DGenerateType(generateType);
  return {
    image_urls: imageUrls,
    tier: "Gen-2.5-High",
    geometry_file_format: "glb",
    material: normalizedGenerateType === "Geometry" ? "None" : enablePbr ? "PBR" : "Shaded",
    quality_mesh_option: rodin25QualityMeshOption(faceCount),
    preview_render: true
  };
}

function nearestRodin25MeshOption(value) {
  const target = Number.isFinite(value) ? value : 500000;
  return rodin25MeshOptions.reduce((nearest, option) => (
    Math.abs(option.faceCount - target) < Math.abs(nearest.faceCount - target) ? option : nearest
  ), rodin25MeshOptions[0]);
}
