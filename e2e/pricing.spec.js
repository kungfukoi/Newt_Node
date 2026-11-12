import {test,expect} from "@playwright/test";
import {openFixture} from "./helpers.mjs";
test("pricing refresh is opt-in and provider quotes update Run without generating",async({page},testInfo)=>{
 const {errors,requests}=await openFixture(page,{generation:true,scale:0.8,settings:{falKeyConfigured:true,modelProviderPreferences:{imageGeneration:"fal"}}});
 let enabled=false,revision=1,refreshes=0;
 const status=()=>({enabled,running:false,lastCheckAt:null,sources:{fal:{status:"bundled"},krea:{status:"disabled"},atlas:{status:"disabled"},openai:{status:"disabled"},google:{status:"disabled"}},catalog:{version:1,revision:"pricing-"+revision,accountRevision:"test-account",entries:{}}});
 await page.route("**/api/pricing",r=>r.fulfill({json:status()}));
 await page.route("**/api/pricing/settings",r=>{enabled=r.request().postDataJSON().enabled;return r.fulfill({json:status()});});
 await page.route("**/api/pricing/refresh",r=>{refreshes++;revision++;return r.fulfill({json:status()});});
 const quotes=[];
 await page.route("**/api/pricing/quote",r=>{const body=r.request().postDataJSON();quotes.push(body);return r.fulfill({json:{amountUsd:0.42,pricingStatus:"estimated",pricingBasis:"Mock account estimate",accountRevision:"test-account",checkedAt:new Date().toISOString()}});});
 await page.getByRole("button",{name:"Settings",exact:true}).click();
 const pricing = page.getByRole("button", { name: "API Pricing", exact: true });
 const auto = page.getByRole("switch", { name: "Automatic pricing refresh" });
 const nav = page.getByRole("navigation", { name: "Settings sections" });
 const overview = nav.getByRole("button", { name: "Overview", exact: true });
 const credentials = nav.getByRole("button", { name: "API Credentials", exact: true });
 await expect(overview).toHaveAttribute("aria-current", "true");
 await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
 await pricing.press("Enter");
 await expect(pricing).toHaveAttribute("aria-current", "true");
 const pricingHeading = page.getByRole("heading", { name: "API Pricing", exact: true });
 await expect(pricingHeading).toBeVisible();
 const navBox = await nav.boundingBox();
 expect((await pricingHeading.boundingBox()).x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
 await credentials.click();
 await expect(credentials).toHaveAttribute("aria-current", "true");
 await expect(auto).toBeHidden();
 await pricing.press("Enter");
 await expect(auto).toHaveAttribute("aria-checked", "false");
 expect(refreshes).toBe(0);
 await auto.click();await expect(auto).toHaveAttribute("aria-checked","true");await auto.click();await expect(auto).toHaveAttribute("aria-checked","false");
 await page.getByRole("button",{name:"Check prices now"}).click();await expect.poll(()=>refreshes).toBe(1);
 await page.screenshot({path:testInfo.outputPath("pricing-settings.png")});
 await page.setViewportSize({ width: 480, height: 900 });
 const narrowNav = await nav.boundingBox();
 expect((await pricingHeading.boundingBox()).y).toBeGreaterThanOrEqual(narrowNav.y + narrowNav.height);
 await page.setViewportSize({ width: 1600, height: 1100 });
 await page.getByRole("button",{name:"Nodes",exact:true}).click();
 await expect(page.locator('[data-node-card-id="model"]').getByRole("button",{name:/Run Image/})).toContainText("Est. $0.42");
 expect(quotes.length).toBeGreaterThan(0);expect(quotes.every(q=>!Object.hasOwn(q,"prompt")&&!Object.hasOwn(q,"references"))).toBe(true);
 expect(requests.filter(r=>r.path==="/api/node/generate-image")).toHaveLength(0);expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath("run-price.png")});
});

test("API Pricing reconciles Local Stats and an unpriced ledger row accepts a verified charge", async ({ page }) => {
  const { errors } = await openFixture(page);
  const history = ["estimate", "manual"].map(id => ({
    id, createdAt: new Date().toISOString(), provider: "fal", modelName: id, mediaType: "video", cost: { amountUsd: null }
  }));
  await page.route("**/api/pricing", route => route.fulfill({ json: { enabled: false, running: false, sources: {}, catalog: { version: 1, entries: {} } } }));
  await page.route("**/api/stats/local", route => route.fulfill({ json: { history } }));
  await page.route("**/api/pricing/reconcile", route => {
    expect(route.request().headers()["x-newt-local"]).toBe("1");
    history[0].cost = { amountUsd: 0.5, estimated: true, pricingBasis: "Historical estimate" };
    return route.fulfill({ json: { updated: 1, unpriced: 1, total: 2 } });
  });
  await page.route("**/api/pricing/record-charge", route => {
    expect(route.request().postDataJSON()).toEqual({ provider: "fal", runId: "manual", amountUsd: 1.25 });
    history[1].cost = { amountUsd: 1.25, estimated: false, pricingSource: "manual-provider-billing" };
    return route.fulfill({ json: { cost: history[1].cost, historySynced: true } });
  });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "API Pricing", exact: true }).click();
  await page.getByRole("button", { name: "Reconcile unpriced runs" }).click();
  await expect(page.getByText("Priced 1 of 2 unpriced runs. 1 still unpriced in Local Stats.")).toBeVisible();
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  const ledger = page.locator(".analytics-ledger");
  await expect(ledger.getByText("Estimate / unverified")).toBeVisible();
  await page.getByRole("button", { name: "Show all unpriced runs" }).click();
  await expect(ledger.locator("tbody tr")).toHaveCount(1);
  await ledger.locator("summary").click();
  await ledger.getByLabel("Verified charge in USD").fill("1.25");
  await ledger.getByRole("button", { name: "Record charge" }).click();
  await expect(ledger.getByText("Recorded a $1.25 charge in Local Stats.")).toBeVisible();
  await expect(ledger.locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("Cost / run state").selectOption("");
  await expect(ledger.getByText("Manual charge")).toBeVisible();
  await expect(ledger.getByText("$1.25", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
