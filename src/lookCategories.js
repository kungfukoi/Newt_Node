export const defaultLookCategories = ["Architects", "Designers", "Fashion designers", "Filmmakers", "Genres", "Illustrators", "Modifiers", "Painters", "Photographers", "Printmakers", "SREF codes", "Sculptors", "Street artists", "Techniques", "Titles", "Various"];
export function lookTags(values = []) {
  const seen = new Set();
  return values.filter(value => typeof value === "string").map(value => value.trim().slice(0, 80)).filter(value => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 40);
}
export const lookCategories = values => lookTags([...defaultLookCategories, ...(values || [])]).sort((a, b) => a.localeCompare(b));
