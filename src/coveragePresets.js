export const coverageMethods = ["Standard", "Dynamic", "Insane"];

const baseInstruction =
  "Use the provided image as the base image. Keep the same subject matter, the same exact subject or subjects with the same pose, same eyeline, same location, same lighting, and same color grade. Change only the camera angle.";

export const coveragePresets = {
  Standard: [
    {
      label: "Worm's Eye View",
      direction:
        "Re-render the scene to a true Warm's Eye View: a wide-angle lens with the camera positioned low, pointing up from the ground, so we look up at the subject. Standard film blocking technique."
    },
    {
      label: "Bird's Eye View",
      direction:
        "Re-render the scene to a Bird's Eye View: a high-angle shot with a 35mm lens. Standard film blocking technique."
    },
    {
      label: "Three-Quarter Medium Shot",
      direction:
        "Re-render the scene to a three-quarter-view medium shot with a 50mm lens and shallow depth of field. Standard film blocking technique."
    },
    {
      label: "Macro Extreme Close-Up",
      direction:
        "Re-render the scene to a macro extreme close-up, shot on a macro probe lens. Standard film blocking technique."
    },
    {
      label: "Wide Full Shot",
      direction:
        "Re-render the scene to a wide full shot with a 35mm lens at eye level. Standard film blocking technique."
    },
    {
      label: "Three-Quarter Portrait Close-Up",
      direction:
        "Re-render the scene to a close-up portrait at a slight three-quarter angle with the eyeline off camera, using a 50mm lens at eye level. Standard film blocking technique."
    },
    {
      label: "Profile Close-Up",
      direction:
        "Re-render the scene to a profile close-up with a 50mm lens at eye level. Standard film blocking technique."
    },
    {
      label: "Medium Wide Shot",
      direction:
        "Re-render the scene to a medium wide shot with a 50mm lens at eye level. Standard film blocking technique."
    },
    {
      label: "Extreme Close-Up",
      direction:
        "Re-render the scene to an extreme close-up with an 85mm lens at eye level. Standard film blocking technique."
    }
  ],
  Dynamic: [
    {
      label: "Dynamic Worm's Eye View",
      direction:
        "Re-render the scene to a true Worm's Eye View: a wide-angle lens with the camera positioned directly below the subject, pointing up from the ground, so we look directly up at the subject in a heroic stance. Create a new dynamic composition."
    },
    {
      label: "True Bird's Eye View",
      direction:
        "Re-render the scene to a true Bird's Eye View: the camera positioned directly above the subject, pointing straight down, so we look directly down onto the top of the subject and the floor fills most of the frame. The subject is seen from directly overhead, foreshortened on the ground below."
    },
    {
      label: "Low-Angle Three-Quarter Medium Shot",
      direction:
        "Re-render the scene to a low-angle three-quarter-view medium shot with a 35mm lens, dynamic framing, and shallow depth of field."
    },
    {
      label: "Dynamic Macro Extreme Close-Up",
      direction:
        "Re-render the scene to a macro extreme close-up with dynamic framing, shot on a macro probe lens. Extremely close, with very shallow depth of field and extremely detailed textures."
    },
    {
      label: "Dynamic Wide Full Shot",
      direction:
        "Re-render the scene to a wide full shot with an 18mm lens and dynamic framing."
    },
    {
      label: "Wide-Angle Portrait Close-Up",
      direction:
        "Re-render the scene to a close-up portrait at a slight three-quarter angle with the eyeline off camera, using a wide 24mm lens, dynamic framing, and shallow depth of field."
    },
    {
      label: "Dynamic Profile Medium Shot",
      direction:
        "Re-render the scene to a profile medium shot with a 50mm lens, dynamic framing, and shallow depth of field."
    },
    {
      label: "Dutch-Angle High Shot",
      direction:
        "Re-render the scene to a slightly Dutch-angled high shot with an 18mm lens and dynamic framing."
    },
    {
      label: "Low-Angle 180-Degree Back View",
      direction:
        "Re-render the scene to a 180-degree back view with a 35mm lens and dynamic low-angle framing."
    }
  ],
  Insane: [
    {
      label: "Extreme Dutch Worm's Eye View",
      direction:
        "Re-render the scene to a true Worm's Eye View: a very wide-angle lens with the camera positioned directly below the subject, pointing up from the ground, so we look directly up at the subject in a heroic stance. Create a new dynamic composition with a Dutch angle and an extremely wide-angle lens. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Distorted Bird's Eye View",
      direction:
        "Re-render the scene to a true Bird's Eye View: the camera positioned directly above the subject, pointing straight down, so we look directly down onto the top of the subject and the floor fills most of the frame. The subject is seen from directly overhead, foreshortened on the ground below. Place the crazy wide-angle camera extremely far from the subject, with a slight Dutch angle and strong lens distortion. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Fisheye Low-Angle Three-Quarter Shot",
      direction:
        "Re-render the scene to a low-angle three-quarter-view medium shot with an 8mm fisheye lens, dynamic framing, and very shallow depth of field. Give it a music-video composition."
    },
    {
      label: "Abstract Macro Extreme Close-Up",
      direction:
        "Re-render the scene to a macro extreme close-up with dynamic framing, shot on a macro probe lens. Extremely close, with very shallow depth of field and extremely detailed textures. Make the view angle extremely abstract and intense. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Fisheye Wide Full Shot",
      direction:
        "Re-render the scene to a wide full shot with a 12mm fisheye lens and dynamic framing. Use a slight Dutch angle and strong lens distortion. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Distorted Wide-Angle Portrait",
      direction:
        "Re-render the scene to a close-up portrait at a slight three-quarter angle with the eyeline off camera, using a slightly fisheye 18mm lens, dynamic framing, and shallow depth of field. Use a lower camera view, lens distortion, and a slight Dutch angle. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Long-Lens Off-Center Profile",
      direction:
        "Re-render the scene to a profile medium shot with a 100mm zoom lens, dynamic off-center framing, and extremely shallow depth of field. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Dutch-Angle High Macro Extreme Close-Up",
      direction:
        "Re-render the scene to a Dutch-angled high macro extreme close-up shot with dynamic off-center framing, shot on a macro probe lens. Extremely close, with very shallow depth of field and extremely detailed textures. Make the view angle extremely abstract and intense. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    },
    {
      label: "Off-Center High Back View",
      direction:
        "Re-render the scene to a 180-degree back view with an 18mm lens and dynamic, off-center, high-angle framing. Drastically break the norms. Not typical framing. Not standard framing. Not stock."
    }
  ]
};

export function normalizeCoverageMethod(value) {
  return coverageMethods.includes(value) ? value : coverageMethods[0];
}

export function normalizeCoverageSettings(data = {}) {
  return {
    coverageSubject: data.coverageSubject === "Location" ? "Location" : "Subject",
    coverageLocationType: data.coverageLocationType === "Exterior" ? "Exterior" : "Interior",
    coverageExploration: data.coverageExploration === "Explore unseen space" ? "Explore unseen space" : "Stay near reference"
  };
}

export function locationCoverageShots(data = {}) {
  const settings = normalizeCoverageSettings(data);
  const exterior = settings.coverageLocationType === "Exterior";
  const explore = settings.coverageExploration === "Explore unseen space";
  const base = "Use the provided image as the visual reference for the same physical location. Scout this location for compelling film shots without talent. Preserve architectural style, spatial layout, proportions, structural elements, materials, furnishings, landscape, lighting conditions, time of day, and color grade. Treat the location as a coherent three-dimensional space. Move the camera rather than rearranging the location. Use physically plausible perspective, occlusion, scale, and accessible camera positions. Keep established features and objects in consistent positions. Do not add people. Produce one image, not a collage or contact sheet, with no labels or text overlays.";
  const exploration = explore
    ? "Explore unseen areas when the requested view requires them. Infer unseen geography conservatively from the visible design; preserve all established landmarks and do not invent unrelated rooms, buildings, or features."
    : "Stay close to the visible reference geography. Use modest camera displacement and favor established features. For reverse or opposite-side views, use a partial reverse toward a known landmark rather than inventing a full unseen space. Do not expose unsupported rooms or structures.";
  const directions = [
    ["Establishing Wide", "Find a strong establishing wide shot with a 24–35mm lens at eye level. Show the location's character, readable geography, and a clear focal point. Use foreground, middle ground, and background to create depth."],
    [exterior ? "Alternate Approach Wide" : "Opposite-Corner Wide", exterior ? "Find an alternate approach to the same location with a 28mm lens. Use visible paths, terrain, or architecture as leading lines toward an established landmark." : "Move toward the opposite accessible corner for a 24–28mm wide view across the same space. Reveal its depth and relationships between established features without moving furnishings."],
    ["Reverse View", "Scout a reverse shooting direction looking back toward the original camera area, using a 35mm lens. Anchor the composition to established landmarks and preserve their spatial relationships. Respect the exploration constraint when the reverse geography is unknown."],
    ["Left-Side View", "Move to an accessible position on the left of the original viewpoint and shoot across the space with a 35mm lens. Seek a strong lateral composition with layered depth and an established focal feature."],
    ["Right-Side View", "Move to an accessible position on the right of the original viewpoint and shoot across the space with a 35–50mm lens. Find a complementary composition with framing elements and a clear background, distinct from the left-side view."],
    [exterior ? "Arrival / Approach" : "Entrance / Threshold", exterior ? "Scout an arrival shot from an established route or boundary with a 35mm lens. Frame the approach to the location through visible foreground elements; do not invent a road or entrance." : "Scout a 35mm shot from a visible entrance or threshold looking into the space. Use the doorway as natural framing if present; otherwise use an established opening or foreground edge. Do not invent a doorway."],
    ["Elevated Overview", exterior ? "Find a plausible elevated 28–35mm view from nearby terrain or an accessible vantage point. Clarify the location's layout and spatial relationships while keeping established landmarks consistent." : "Find a modestly elevated 28mm overview from a plausible camera position within the room, below its ceiling. Clarify the floor plan and layers without a cutaway, removed wall, or impossible overhead camera."],
    ["Primary Feature", "Scout a deliberate 50mm composition around the location's most distinctive existing architectural or environmental feature. Use light, negative space, and foreground framing to make it a useful cinematic shot rather than a centered inventory photo."],
    ["Material / Detail", "Find a cinematic 85mm detail shot of a distinctive existing material, fixture, furnishing, or natural feature. Preserve its design, texture, wear, and lighting. Include enough context to connect it to the same location; do not invent a new prop."]
  ];
  return directions.map(([label, direction], index) => ({
    id: "location-" + (exterior ? "exterior" : "interior") + "-" + (index + 1), label, direction,
    prompt: base + " " + exploration + " Location type: " + settings.coverageLocationType + ". " + direction
  }));
}

export function coverageShotsForMethod(value, data = {}) {
  if (normalizeCoverageSettings(data).coverageSubject === "Location") return locationCoverageShots(data);
  const method = normalizeCoverageMethod(value);
  return coveragePresets[method].map((shot, index) => ({
    ...shot,
    id: `${method.toLowerCase()}-${index + 1}`,
    prompt: `${baseInstruction} ${shot.direction}`
  }));
}

export function coveragePreviewItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.url)
    .map((item) => ({ ...item, sourceUrl: item.url }));
}

export function coveragePromptForInputs(shot, { hasStyle = false, hasMoodBoard = false, hasCharacters = false } = {}) {
  let prompt = shot.prompt;
  if (hasStyle || hasMoodBoard) {
    prompt = prompt.replace("same lighting, and same color grade", "same physical lighting setup")
      .replace("lighting conditions, time of day, and color grade", "physical lighting conditions and time of day");
    prompt += " Connected Style and Mood Board inputs may change the rendering treatment, palette, and grade while preserving location geometry, recognizable materials, and the requested camera composition. Explicit Style instructions take precedence over conflicting Mood Board treatment. Mood Board imagery is treatment reference only: do not copy its subjects, geography, text, borders, or collage layout.";
  }
  if (hasCharacters) {
    prompt = prompt.replace("Do not add people.", "Include the connected referenced characters naturally within this location. Do not add unreferenced people.")
      .replace("Scout this location for compelling film shots without talent.", "Scout this location for compelling film shots with the connected characters.")
      .replace("the same exact subject or subjects with the same pose, same eyeline", "the subjects' existing pose, eyeline, and blocking, using the connected Character references as identity and wardrobe authority");
    prompt += " Use the connected Character sheets for identity and selected wardrobe only, never their sheet layout or studio background. Preserve existing blocking and world-space positions when present in the base image; otherwise place the connected characters naturally and consistently in the location. Character references override conflicting base-image identity. Do not rearrange the location to match a character sheet.";
  }
  return prompt;
}
