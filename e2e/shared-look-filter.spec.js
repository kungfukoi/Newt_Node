import {test,expect} from "@playwright/test";
import {chooseLookbookSource,openFixture} from "./helpers.mjs";
import {createStyleRefCatalog} from "../server/styleref-catalog.js";

test("User Looks shows only shared-store looks, supports search, and reports unavailable storage",async({page})=>{
  const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let unavailable=false;
  const shared=["Shared Ink","Shared Wash"].map((name,index)=>({id:`look-${index}`,name,category:"Illustration",tags:[],prompt:"Paper texture",sourceProvider:"Newt",examples:[{localUrl:"/outputs/e2e/shared.png"}]}));
  const catalog=createStyleRefCatalog({createdStore:{state:async()=>({mode:"shared"}),read:async()=>{if(unavailable)throw Object.assign(Error("Shared folder unavailable. Mount LucidLink."),{status:503});return shared;}},fetchImpl:async()=>Response.json({styles:[{slug:"online-ink",name:"Online Ink",category:"Illustration",tags:[]}],hasMore:false})});
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library",route=>json(route,{revision:0,collections:[]}));
  await page.route("**/api/style-library/catalog?**",async route=>{
    try{return json(route,await catalog.search({own:true}));}
    catch(error){return json(route,{error:error.message},error.status||503);}
  });
  await page.route("**/api/style-library/shared-user-looks?**",route=>{
    if(unavailable)return json(route,{error:"Shared folder unavailable. Mount LucidLink."},503);
    const query=new URL(route.request().url()).searchParams.get("q").toLowerCase();
    const styles=shared.filter(style=>style.name.toLowerCase().includes(query));
    return json(route,{ready:true,styles,total:styles.length,categories:["Illustration"]});
  });
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Commercial");
  await expect(page.getByRole("button",{name:"View Online Ink",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toHaveCount(0);await chooseLookbookSource(page,"User Looks");
  await expect(page.getByText("2 shared looks",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Online Ink",exact:true})).toHaveCount(0);
  const strip=page.getByLabel("Style previews",{exact:true});await expect(strip.locator(".stylebuilder-tile")).toHaveCount(2);
  const search=page.getByRole("textbox",{name:"Search looks",exact:true});await search.fill("Ink");await expect(page.getByText("1 shared look",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await search.fill("no-matching-shared-look");await expect(strip).toContainText("No styles match this view.");
  await search.fill("");await expect(strip.locator(".stylebuilder-tile")).toHaveCount(2);
  unavailable=true;await page.getByRole("button",{name:"Refresh catalog",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Mount LucidLink");
  expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});

test("All combines paged catalog results and saved copies without repeats",async({page})=>{
  await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  const ink={id:"styleref-ink",catalogId:"styleref-ink",name:"Ink",category:"Illustration",examples:[]};
  const photo={id:"stylefinder-photo",name:"Photo",category:"Photography",examples:[]};
  const wash={id:"look-wash",name:"Wash",category:"Illustration",examples:[]};
  const pencil={id:"pencil",name:"Pencil",category:"Illustration",examples:[]};
  const reads=[];
  await page.route("**/api/style-library/storage",route=>route.fulfill({json:{mode:"shared",looksDirectory:"C:/Shared"}}));
  await page.route("**/api/style-library",route=>route.fulfill({json:{revision:0,collections:[
    {id:"cinema",name:"Cinema",styles:[{...ink,id:"saved-ink"},pencil]},
    {id:"starred",name:"Starred",styles:[{...ink,id:"starred-ink"}]},
  ]}}));
  for(const [endpoint,items] of [["catalog",[ink]],["stylefinder",[photo]],["shared-user-looks",[ink,wash]],["local-looks",[]]]){
    await page.route(`**/api/style-library/${endpoint}?**`,route=>{
      const params=new URL(route.request().url()).searchParams;
      const category=params.get("category"),offset=Number(params.get("offset")),query=params.get("q");
      const matches=items.filter(style=>(!category||style.category===category)&&style.name.toLowerCase().includes(query.toLowerCase()));
      reads.push({endpoint,offset,own:params.get("own"),query});
      return route.fulfill({json:{ready:true,total:matches.length,styles:matches.slice(offset,offset+1),
        categories:[...new Set(items.map(style=>style.category))]}});
    });
  }
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"All");
  await expect(page.getByRole("button",{name:"View Wash",exact:true})).toBeVisible();
  for(const name of ["Ink","Photo","Pencil"]){
    await expect(page.getByRole("button",{name:`View ${name}`,exact:true})).toHaveCount(1);
  }
  expect(reads).toContainEqual({endpoint:"shared-user-looks",offset:1,own:"1",query:""});
  const commercialReads=reads.filter(({endpoint})=>endpoint==="catalog").length;
  await page.getByRole("button",{name:"Refresh catalog",exact:true}).click();
  await expect.poll(()=>reads.filter(({endpoint})=>endpoint==="catalog").length).toBeGreaterThan(commercialReads);
  await expect(page.getByRole("button",{name:"View Wash",exact:true})).toBeVisible();
  expect(reads.some(({endpoint})=>endpoint==="local-looks")).toBe(false);
  await page.getByRole("combobox",{name:"Look category",exact:true}).click();
  await page.getByRole("option",{name:"Photography",exact:true}).click();
  await expect(page.getByRole("button",{name:"View Photo",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"View Ink",exact:true})).toHaveCount(0);
  await chooseLookbookSource(page,"Starred");
  await expect(page.getByRole("button",{name:"View Ink",exact:true})).toHaveCount(1);
  await expect(page.getByRole("button",{name:"View Pencil",exact:true})).toBeVisible();

  const search=page.getByRole("textbox",{name:"Search looks",exact:true});
  const strip=page.getByLabel("Style previews",{exact:true});
  const beforeSavedSearch=reads.length;
  await search.fill("Wash");
  await expect(strip).toContainText("No styles match this view.");
  await chooseLookbookSource(page,"Cinema");
  await expect(strip).toContainText("No styles match this view.");
  expect(reads).toHaveLength(beforeSavedSearch);

  await chooseLookbookSource(page,"All");
  await expect(page.getByRole("button",{name:"View Wash",exact:true})).toBeVisible();
  expect(reads.filter(read=>read.query==="Wash").map(read=>read.endpoint).sort())
    .toEqual(["catalog","shared-user-looks","stylefinder"]);

  const beforeCommercialSearch=reads.length;
  await chooseLookbookSource(page,"Commercial");
  await expect(strip).toContainText("No styles match this view.");
  await search.fill("Ink");
  await expect(page.getByRole("button",{name:"View Ink",exact:true})).toBeVisible();
  await search.fill("Photo");
  await expect(page.getByRole("button",{name:"View Ink",exact:true})).toHaveCount(0);
  await expect(strip).toContainText("No styles match this view.");
  expect(reads.slice(beforeCommercialSearch).map(read=>read.endpoint)).toEqual(["catalog","catalog","catalog"]);
  await chooseLookbookSource(page,"StyleFinder");
  await expect(page.getByRole("button",{name:"View Photo",exact:true})).toBeVisible();
  expect(reads.at(-1)).toEqual({endpoint:"stylefinder",offset:0,own:"1",query:"Photo"});
});
