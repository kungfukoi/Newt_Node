export const defaultLookCategories = ["Fine art", "Illustration", "Photography", "Graphic design", "Cinematography", "3D visualization", "Character design", "Game art", "Brand identity", "Packaging design", "UI/UX", "Various"];
export function lookTags(values = []) {
  const seen = new Set();
  return values.filter(value => typeof value === "string").map(value => value.trim().slice(0, 80)).filter(value => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 40);
}
export const lookCategories = values => lookTags([...defaultLookCategories, ...(values || [])]).sort((a, b) => a.localeCompare(b));
