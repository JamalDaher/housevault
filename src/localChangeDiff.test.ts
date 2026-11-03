import {describe,it,expect} from "vitest";
import {diffLocalInventory} from "./localChangeDiff";
import type {Item} from "./domain";
const a:Item={id:"a",name:"Hammer",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const b:Item={...a,id:"b",name:"Drill"};
describe("local inventory change detection",()=>{
 it("detects additions, edits and deletions",()=>{
  expect(diffLocalInventory([],[a])).toEqual([{itemId:"a",operation:"upsert",payload:a}]);
  expect(diffLocalInventory([a],[{...a,value:20}])[0].operation).toBe("upsert");
  expect(diffLocalInventory([a],[])).toEqual([{itemId:"a",operation:"delete",payload:null}]);
 });
 it("ignores unchanged records and reorder",()=>{
  expect(diffLocalInventory([a,b],[b,a])).toEqual([]);
 });
 it("does not enqueue attachments",()=>{
  expect(diffLocalInventory([],[{...a,photo:"data:image/png;base64,YQ=="}])).toEqual([]);
  expect(diffLocalInventory([{...a,photo:"data:image/png;base64,YQ=="}],[])).toEqual([]);
 });
 it("rejects ambiguous duplicate identities",()=>{
  expect(()=>diffLocalInventory([],[a,a])).toThrow();
  expect(()=>diffLocalInventory([a,a],[])).toThrow();
 });
});
