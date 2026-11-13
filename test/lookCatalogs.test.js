import test from "node:test";
import assert from "node:assert/strict";
import { lookSourceOptions, lookLibraryOptions, namedLookCollections, allSavedCatalogLooks } from "../src/lookCatalogs.js";
test("Lookbook sources, saved views and named destinations are separate",()=>{
  const collections=[{id:"fav",name:"Starred",styles:[]},{id:"cinema",name:"Cinema",styles:[]}];
  assert.deepEqual(lookSourceOptions(true,true).map(item=>item.label),["All Sources","Commercial","Looks Catalog","User Looks","Film Stills","Local Looks"]);
  assert.deepEqual(lookLibraryOptions(collections).map(item=>item.label),["All Saved","Starred","Cinema"]);
  assert.deepEqual(lookLibraryOptions([]).map(item=>item.label),["All Saved","Starred"]);
  assert.deepEqual(namedLookCollections(collections).map(item=>item.id),["cinema"]);
});
test("All deduplicates saved copies and keeps an available saved analysis",()=>{
  const look={id:"one",name:"Ink",sourceUrl:"https://catalog.example/library/ink"};
  const result=allSavedCatalogLooks([{styles:[look]},{styles:[{...look,id:"two",catalogId:"catalog-ink",styleAnalysis:{stylePrompt:"Ink rendering"}}]}]);
  assert.equal(result.length,1);assert.equal(result[0].styleAnalysis.stylePrompt,"Ink rendering");
});
