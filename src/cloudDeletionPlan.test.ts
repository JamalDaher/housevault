import {describe,expect,it} from "vitest";
import {planCloudDeletion} from "./cloudDeletionPlan";
import type {Item} from "./domain";
const item=(name="Saw"):Item=>({id:"saw",name,category:"Tools",location:"Shop",quantity:1,value:20,notes:""});
const base={revision:"r1",value:item()};
const remote={revision:"r1",value:item()};
describe("cloud deletion proposal safety",()=>{
 it("proposes only missing local items with unchanged cloud revisions",()=>{
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:base,remote})).toEqual({kind:"eligible",itemId:"saw",expectedRevision:"r1",lastKnown:item()});
 });
 it("does not delete items still on device or never tracked",()=>{
  expect(planCloudDeletion({itemId:"saw",local:item(),baseline:base,remote}).kind).toBe("not-deleted");
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:null,remote}).kind).toBe("untracked");
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:base,remote:null}).kind).toBe("untracked");
 });
 it("blocks remote revisions and payloads changed on another device",()=>{
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:base,remote:{revision:"r2",value:item()}})).toMatchObject({kind:"conflict",reason:"remote-changed"});
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:base,remote:{revision:"r1",value:item("Updated")}})).toMatchObject({kind:"conflict",reason:"remote-changed"});
 });
 it("blocks attachments and identity mismatch",()=>{
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:{revision:"r1",value:{...item(),photo:"photo"}},remote})).toMatchObject({kind:"conflict",reason:"attachments"});
  expect(planCloudDeletion({itemId:"saw",local:null,baseline:base,remote:{revision:"r1",value:{...item(),photos:["photo"]}}})).toMatchObject({kind:"conflict",reason:"attachments"});
  expect(planCloudDeletion({itemId:"other",local:null,baseline:base,remote})).toMatchObject({kind:"conflict",reason:"invalid-identity"});
 });
});
