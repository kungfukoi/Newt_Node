export const filmDirectorStillDuration = "still";

export const filmDirectorDurationOptions = [
  filmDirectorStillDuration,
  ...Array.from({ length: 27 }, (_value, index) => String(index + 4))
];

export function filmDirectorIsStillDuration(value) {
  return String(value || "").trim().toLowerCase() === filmDirectorStillDuration;
}

export function normalizeFilmDirectorDuration(value, fallback = "15") {
  if (filmDirectorIsStillDuration(value)) return filmDirectorStillDuration;
  const requested = String(Number.parseInt(String(value || ""), 10));
  if (filmDirectorDurationOptions.includes(requested)) return requested;

  if (filmDirectorIsStillDuration(fallback)) return filmDirectorStillDuration;
  const normalizedFallback = String(Number.parseInt(String(fallback || ""), 10));
  return filmDirectorDurationOptions.includes(normalizedFallback) ? normalizedFallback : "15";
}

export function filmDirectorDurationOptionLabel(value) {
  const normalized = normalizeFilmDirectorDuration(value);
  return filmDirectorIsStillDuration(normalized) ? "Still" : `${normalized}s`;
}

export function filmDirectorShotCountForDuration(shotCount = "3", duration = "15") {
  return filmDirectorIsStillDuration(duration) ? "1" : String(shotCount || "3");
}

export function filmDirectorDurationPromptList() {
  return filmDirectorDurationOptions.join(", ");
}
