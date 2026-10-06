import { pricingApi } from "./newtApi.js";
import { generationEstimate } from "../generationPricing.js";
import { getGenerationQuote, setGenerationQuote } from "../pricingCatalog.js";
import { generationQuoteSettings } from "../pricingTrust.js";

export async function refreshGenerationEstimate(raw) {
  const options = generationQuoteSettings(raw);
  const cached = getGenerationQuote(options);
  if (cached) return cached;
  try { const result = await pricingApi.quote(options); return setGenerationQuote(options, result) ? result : generationEstimate(options); }
  catch { return generationEstimate(options); }
}
