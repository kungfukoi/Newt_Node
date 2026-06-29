import React from "react";

export let THREE = null;
export let GLTFLoader = null;
export let MTLLoader = null;
export let OBJLoader = null;
export let cloneSkeleton = null;

let threeRuntimePromise = null;

export function loadThreeRuntime() {
  if (THREE && GLTFLoader && MTLLoader && OBJLoader && cloneSkeleton) {
    return Promise.resolve({ THREE, GLTFLoader, MTLLoader, OBJLoader, cloneSkeleton });
  }

  if (!threeRuntimePromise) {
    threeRuntimePromise = Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/loaders/MTLLoader.js"),
      import("three/examples/jsm/loaders/OBJLoader.js"),
      import("three/examples/jsm/utils/SkeletonUtils.js")
    ]).then(([threeModule, gltfLoaderModule, mtlLoaderModule, objLoaderModule, skeletonModule]) => {
      THREE = threeModule;
      GLTFLoader = gltfLoaderModule.GLTFLoader;
      MTLLoader = mtlLoaderModule.MTLLoader;
      OBJLoader = objLoaderModule.OBJLoader;
      cloneSkeleton = skeletonModule.clone;
      return { THREE, GLTFLoader, MTLLoader, OBJLoader, cloneSkeleton };
    });
  }

  return threeRuntimePromise;
}

export function useThreeRuntimeReady() {
  const [ready, setReady] = React.useState(() => Boolean(THREE && GLTFLoader && MTLLoader && OBJLoader && cloneSkeleton));

  React.useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    loadThreeRuntime()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => {
        if (!cancelled) console.warn("Three.js runtime failed to load.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}

export function degreesToRadians(value) {
  return (finiteNumberValue(value, 0) * Math.PI) / 180;
}

export function radiansToDegrees(value) {
  return (finiteNumberValue(value, 0) * 180) / Math.PI;
}

export function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function finiteNumberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
