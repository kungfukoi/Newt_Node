import { test, expect } from "@playwright/test";
import { chooseLookbookCollection, chooseLookbookSource, openFixture } from "./helpers.mjs";

test("Look details restore multiple memberships from both Sources and My Library", async ({ page }) => {
  const { requests } = await openFixture(page, { fixture: { nodes: [], edges: [], groups: [], viewport: { x: 0, y: 0, scale: 1 } } });
  const look = { id: "catalog-ink", name: "Ink", sourceUrl: "https://styleref.io/share/ink", examples: [] };
  const legacy = { ...look, id: "legacy-ink" };
  let library = { revision: 0, collections: [
    { id: "first", name: "First", styles: [legacy] },
    { id: "second", name: "Second", styles: [] },
    { id: "third", name: "Third", styles: [] },
    { id: "system-starred", name: "Starred", styles: [{ ...look, catalogId: look.id, id: "starred-ink" }] },
  ] };
  let conflict = true;
  let saves = 0;
  await page.route("**/api/style-library", route => {
    if (route.request().method() === "PUT") {
      if (conflict) {
        conflict = false;
        library = { revision: 1, collections: [...library.collections, { id: "fourth", name: "Fourth", styles: [legacy] }] };
        return route.fulfill({ status: 409, json: { error: "Library changed in another window." } });
      }
      const proposed = route.request().postDataJSON();
      expect(proposed.revision).toBe(library.revision);
      saves++;
      library = { ...proposed, revision: library.revision + 1 };
    }
    return route.fulfill({ json: library });
  });
  await page.route("**/api/style-library/catalog?**", route => route.fulfill({ json: { ready: true, total: 1, styles: [look], categories: [] } }));
  await page.route("**/api/style-library/catalog/catalog-ink", route => route.fulfill({ json: { style: look } }));
  await page.getByRole("button", { name: "Looks", exact: true }).click();
  await chooseLookbookSource(page, "Commercial");
  const details = page.getByRole("dialog", { name: "Style details" });
  const memberships = details.getByRole("list", { name: "Look collections" }).getByRole("listitem");
  const picker = page.getByRole("dialog", { name: "Manage collections" });
  const membership = name => picker.getByRole("checkbox", { name, exact: true });
  const save = picker.getByRole("button", { name: "Save collections" });
  await page.getByRole("button", { name: "View Ink", exact: true }).click();
  await expect(memberships).toHaveText(["First"]);
  await details.getByRole("button", { name: "Manage collections…" }).click();
  await expect(membership("First")).toBeChecked();
  await expect(save).toBeDisabled();
  await membership("First").uncheck();
  await membership("Second").check();
  await membership("Third").check();
  await save.click();
  await expect(picker.getByRole("alert")).toContainText("Library changed");
  await expect(membership("First")).not.toBeChecked();
  await expect(membership("Second")).toBeChecked();
  await expect(membership("Third")).toBeChecked();
  await expect(membership("Fourth")).toBeChecked();
  await save.click();
  await expect(picker).not.toBeVisible();
  await expect(memberships).toHaveText(["Second", "Third", "Fourth"]);
  expect(saves).toBe(1);
  expect(library.collections.map(collection => collection.styles.length)).toEqual([0, 1, 1, 1, 1]);
  await expect(details.getByRole("button", { name: "Unstar look" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await page.getByRole("button", { name: "Looks", exact: true }).click();
  await chooseLookbookCollection(page, "Third");
  await page.getByRole("button", { name: "View Ink", exact: true }).click();
  await expect(memberships).toHaveText(["Second", "Third", "Fourth"]);
  await details.getByRole("button", { name: "Close style details" }).click();
  await chooseLookbookCollection(page, "All Saved");
  await expect(page.getByRole("button", { name: "View Ink", exact: true })).toHaveCount(1);
  await chooseLookbookSource(page, "Commercial");
  await page.getByRole("button", { name: "View Ink", exact: true }).click();
  await expect(memberships).toHaveText(["Second", "Third", "Fourth"]);
  expect(requests.some(({ path }) => path === "/api/style-library/analyze")).toBe(false);
});

test("The details star persists changes and stays open after unstarring from a named catalog",async({page})=>{
  const {errors}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  const style={id:"ink",catalogId:"styleref-ink",name:"Ink",sourceUrl:"https://styleref.io/share/ink",examples:[{localUrl:"/outputs/e2e/ink.png"}],styleAnalysis:{stylePrompt:"Fine broken ink edges on warm paper"}};
  let library={revision:0,collections:[{id:"cinema",name:"Cinema",styles:[style]}]},fail=false;
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library",route=>{if(route.request().method()==="PUT"){if(fail)return json(route,{error:"Collection changed; retry"},409);library={...route.request().postDataJSON(),revision:library.revision+1};}return json(route,library);});
  await page.route("**/api/style-library/catalog?**",route=>json(route,{ready:true,total:0,styles:[],categories:[]}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();await chooseLookbookCollection(page,"Cinema");
  await expect(page.getByRole("button",{name:"Star look: Ink",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"View Ink",exact:true}).click();const details=page.getByRole("dialog",{name:"Style details",exact:true});
  await details.getByRole("button",{name:"Star look",exact:true}).click();
  await expect(details.getByRole("button",{name:"Unstar look",exact:true})).toHaveAttribute("aria-pressed","true");
  expect(library.collections.find(item=>item.name==="Starred").styles).toHaveLength(1);
  fail=true;await details.getByRole("button",{name:"Unstar look",exact:true}).click();await expect(details.getByRole("alert")).toContainText("Collection changed");await expect(details.getByRole("button",{name:"Unstar look",exact:true})).toHaveAttribute("aria-pressed","true");
  fail=false;await details.getByRole("button",{name:"Unstar look",exact:true}).click();await expect(details).toBeVisible();await expect(details.getByRole("button",{name:"Star look",exact:true})).toHaveAttribute("aria-pressed","false");expect(library.collections[0].styles).toEqual([style]);
  expect(library.collections.find(item=>item.name==="Starred").styles).toHaveLength(0);
  await details.getByRole("button",{name:"Star look",exact:true}).click();await expect(details.getByRole("button",{name:"Unstar look",exact:true})).toHaveAttribute("aria-pressed","true");await expect(details).toBeVisible();
  await details.screenshot({path:test.info().outputPath("look-details-star.png")});
  await page.reload();await page.getByRole("button",{name:"Looks",exact:true}).click();await chooseLookbookCollection(page,"Starred");await page.getByRole("button",{name:"View Ink",exact:true}).click();await expect(details.getByRole("button",{name:"Unstar look",exact:true})).toHaveAttribute("aria-pressed","true");expect(errors).toEqual([]);
});

test("Selected looks create a collection atomically and keep existing collections intact", async ({ page }) => {
  const { errors, requests } = await openFixture(page, { fixture: { nodes: [], edges: [], groups: [], viewport: { x: 0, y: 0, scale: 1 } } });
  const looks = ["Ink", "Wash"].map(name => ({
    id: name.toLowerCase(), name, sourceUrl: "https://catalog.example/library/" + name.toLowerCase(),
    examples: [{ id: "one", localUrl: "/outputs/e2e/example.png" }],
    styleAnalysis: { stylePrompt: "Fine ink contours on warm textured paper" },
  }));
  const original = { id: "first", name: "First", styles: [looks[0]] };
  let library = { revision: 0, collections: [original] };
  let conflict = true;
  await page.route("**/api/style-library", route => {
    if (route.request().method() === "PUT") {
      if (conflict) {
        conflict = false;
        library = { revision: 1, collections: [...library.collections, { id: "other-window", name: "Other window", styles: [] }] };
        return route.fulfill({ status: 409, json: { error: "Library changed in another window." } });
      }
      const proposed = route.request().postDataJSON();
      expect(proposed.revision).toBe(library.revision);
      library = { ...proposed, revision: library.revision + 1 };
    }
    return route.fulfill({ json: library });
  });
  await page.route("**/api/style-library/catalog?**", route => route.fulfill({ json: { ready: true, total: 2, categories: [], styles: looks } }));
  await page.route("**/api/style-library/catalog/**", route => route.fulfill({ json: { style: looks.find(look => route.request().url().endsWith(look.id)) } }));
  await page.getByRole("button", { name: "Looks", exact: true }).click();
  await chooseLookbookSource(page,"Commercial");
  const source = page.getByRole("combobox", { name: "Looks source", exact: true });
  await source.click();
  await expect(page.getByRole("option", { name: "First", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Starred", exact: true })).toHaveCount(0);
  await source.press("Escape");
  const ink=page.getByRole("checkbox",{name:"Select Ink",exact:true});
  const wash=page.getByRole("checkbox",{name:"Select Wash",exact:true});
  const add=page.getByRole("button",{name:"Add to collection…",exact:true});
  await expect(add).toHaveCount(0);
  await ink.check();await wash.check();await add.click();
  const picker=page.getByRole("dialog",{name:"Add to collection",exact:true});
  await expect(picker.getByRole("radio",{name:"First 1 already saved"})).toBeVisible();
  await expect(picker.getByRole("radio",{name:"Starred"})).toHaveCount(0);
  await picker.getByRole("button",{name:"New collection…",exact:true}).click();
  const create=page.getByRole("dialog",{name:"New collection",exact:true});
  const name=create.getByLabel("Collection name",{exact:true});
  await expect(name).toBeFocused();
  await name.fill("Starred");
  await create.getByRole("button",{name:"Create and add",exact:true}).click();
  await expect(create.getByRole("alert")).toContainText("already in use");
  await name.fill("Cinema references");
  await create.getByRole("button",{name:"Create and add",exact:true}).click();
  await expect(create.getByRole("alert")).toContainText("Library changed");
  await expect(name).toHaveValue("Cinema references");
  expect(library.collections.map(item=>item.name)).toEqual(["First","Other window"]);
  await create.getByRole("button",{name:"Create and add",exact:true}).click();
  await expect(create).not.toBeVisible();
  await expect(ink).not.toBeChecked();await expect(wash).not.toBeChecked();
  await expect(source).toHaveText("Commercial");
  await expect(page.getByRole("status").filter({hasText:"Added 2 looks to Cinema references"})).toBeVisible();
  const created=library.collections.find(item=>item.name==="Cinema references");
  expect(created.styles.map(style=>style.name)).toEqual(["Ink","Wash"]);
  expect(library.collections[0]).toEqual(original);
  expect(library.collections.some(item=>item.id==="other-window")).toBe(true);
  await expect(page.getByRole("button",{name:"Star look: Ink",exact:true})).toHaveAttribute("aria-pressed","false");
  await ink.check();await add.click();
  await picker.getByRole("radio",{name:"Cinema references 1 already saved"}).check();
  await picker.getByRole("button",{name:"Add looks",exact:true}).click();
  await expect(picker).not.toBeVisible();
  expect(library.collections.find(item=>item.id===created.id).styles).toHaveLength(2);

  await chooseLookbookCollection(page,"Cinema references");
  const handle=page.getByRole("separator",{name:"Resize Cinema references rows",exact:true});
  await handle.press("ArrowDown");
  await expect(handle).toHaveAttribute("aria-valuenow","2");
  await page.getByRole("button",{name:"Rename collection",exact:true}).click();
  const rename=page.getByRole("dialog",{name:"Rename collection",exact:true});
  await rename.getByLabel("Collection name",{exact:true}).fill("Night Exteriors");
  await rename.getByRole("button",{name:"Save name",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Collection",exact:true})).toHaveText("Night Exteriors");
  expect(library.collections.find(item=>item.id===created.id).styles).toEqual(created.styles);
  await page.reload();await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookCollection(page,"Night Exteriors");
  await expect(page.getByRole("separator",{name:"Resize Night Exteriors rows",exact:true})).toHaveAttribute("aria-valuenow","2");
  await wash.check();
  await page.getByRole("button",{name:"Remove from collection",exact:true}).click();
  await expect(page.getByRole("button",{name:"View Wash",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Delete collection",exact:true}).click();
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  expect(library.collections.some(item=>item.id===created.id)).toBe(true);
  await page.getByRole("button",{name:"Delete collection",exact:true}).click();
  await page.getByRole("button",{name:"Confirm delete",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Collection",exact:true})).toHaveText("All Saved");
  expect(library.collections.some(item=>item.id===created.id)).toBe(false);
  expect(library.collections[0]).toEqual(original);
  expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);
  expect(errors).toEqual([]);
});
