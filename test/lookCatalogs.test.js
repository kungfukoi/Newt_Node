import test from "node:test";
import assert from "node:assert/strict";
import { lookCatalogOptions, lookSaveOptions, starredCatalogLooks } from "../src/lookCatalogs.js";
test("Built-in Lookbook sources and personal catalogs appear without duplicating Starred",()=>{
  const collections=[{id:"fav",name:"Starred",styles:[]},{id:"cinema",name:"Cinema",styles:[]}];
  assert.deepEqual(lookCatalogOptions(collections).map(item=>item.label),["Commercial","StyleFinder","User Looks","Starred","Cinema"]);
  assert.deepEqual(lookCatalogOptions([]).map(item=>item.label),["Commercial","StyleFinder","User Looks","Starred"]);
  assert.equal(lookSaveOptions(collections)[0].value,"fav");assert.equal(lookSaveOptions([])[0].label,"Starred");
});
test("Starred deduplicates saved copies and keeps an available saved analysis",()=>{
  const look={id:"one",name:"Ink",sourceUrl:"https://midlibrary.io/library/ink"};
  const result=starredCatalogLooks([{styles:[look]},{styles:[{...look,id:"two",styleAnalysis:{stylePrompt:"Ink rendering"}}]}]);
  assert.equal(result.length,1);assert.equal(result[0].styleAnalysis.stylePrompt,"Ink rendering");
});
