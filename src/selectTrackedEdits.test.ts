import {describe,expect,it} from "vitest";
import type {Item} from "./domain";
import {selectTrackedEdits} from "./selectTrackedEdits";
const base:Item={id:"a",name:"Hammer",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const baseline={revision:"r1",value:base};
describe("offline tracked edit selection",()=>{
 it("selects only changed records with trusted matching baselines",()=>{
  const changed={...base,name:"New hammer"};
  const newItem={...base,id:"new"};
  const unchanged={...base,id:"same"};
  const items=[changed,newItem,unchanged];
  const baselines=new Map([["a",baseline],["same",{revision:"r2",value:unchanged}]]);
  expect(selectTrackedEdits({items,baselines,queuedIds:new Set()})).toEqual([changed]);
 });
 it("excludes attachments, already queued records, and sample items",()=>{
  const changed={...base,name:"Changed"};
  const baselines=new Map([["a",baseline],["demo-1",{revision:"r1",value:{...base,id:"demo-1"}}]]);
  expect(selectTrackedEdits({items:[{...changed,photos:["photo"]}],baselines,queuedIds:new Set()})).toEqual([]);
  expect(selectTrackedEdits({items:[changed],baselines,queuedIds:new Set(["a"])})).toEqual([]);
  expect(selectTrackedEdits({items:[{...base,id:"demo-1",name:"Changed"}],baselines,queuedIds:new Set()})).toEqual([]);
 });
 it("rejects duplicate ids and untrusted baseline identities",()=>{
  const changed={...base,name:"Changed"};
  const baselines=new Map([["a",{revision:"r1",value:{...base,id:"other"}}]]);
  expect(selectTrackedEdits({items:[changed,changed],baselines,queuedIds:new Set()})).toEqual([]);
  baselines.set("a",baseline);
  expect(selectTrackedEdits({items:[changed,changed],baselines,queuedIds:new Set()})).toEqual([changed]);
 });
});
