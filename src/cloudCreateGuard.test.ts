import {describe,it,expect} from "vitest";
import {canCreateCloudCopy} from "./cloudCreateGuard";
import type {Item} from "./domain";
const item:Item={id:"tool-1",name:"Tool",category:"Tools",location:"Shop",quantity:1,value:20,notes:""};
describe("safe cloud creation",()=>{
 it("allows only genuinely new attachment-free items",()=>expect(canCreateCloudCopy(item,false,null)).toBe(true));
 it("blocks previously synced items missing remotely, including tombstones",()=>{
  expect(canCreateCloudCopy(item,false,{revision:"old",value:item})).toBe(false);
 });
 it("blocks existing cloud items and attachments",()=>{
  expect(canCreateCloudCopy(item,true,null)).toBe(false);
  expect(canCreateCloudCopy({...item,photos:["image"]},false,null)).toBe(false);
 });
 it("blocks demo and internal test records",()=>{
  expect(canCreateCloudCopy({...item,id:"demo-1"},false,null)).toBe(false);
  expect(canCreateCloudCopy({...item,id:"__housevault_test_1"},false,null)).toBe(false);
 });
});
