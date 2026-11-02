import { describe, expect, it } from "vitest";
import { previewRecordConflicts, validateConflictApprovals, cloudAttachmentPaths, compareEquipmentMetadata } from "./syncFoundation";
import type { Item } from "./domain";

const item=(id:string,name:string,notes=""):Item=>({id,name,notes,category:"Tools",location:"Garage",quantity:1,value:100});

describe("manual sync conflict safety",()=>{
 it("does not mistake JSON object key order for a conflict",()=>{
  const a=item("a","Drill");const b={...a};
  expect(previewRecordConflicts([a],[b])).toEqual([]);
 });
 it("detects changed, device-only and cloud-only records",()=>{
  const conflicts=previewRecordConflicts([item("a","Drill","device"),item("b","Saw")],[item("a","Drill","cloud"),item("c","Hammer")]);
  expect(conflicts.map(c=>[c.id,c.status])).toEqual([["a","different"],["b","device-only"],["c","cloud-only"]]);
  expect(conflicts[0].fields).toContain("notes");
 });
 it("ignores attachment encoding when comparing equipment metadata",()=>{
  const a={...item("a","Drill"),photo:"data:image/png;base64,YQ=="};
  const b={...item("a","Drill"),photo:"cloud-asset:placeholder"};
  expect(compareEquipmentMetadata([a],[b]).kind).toBe("identical");
 });
 it("requires an explicit valid decision for every conflict",()=>{
  const conflicts=previewRecordConflicts([item("a","A"),item("b","B")],[]);
  expect(validateConflictApprovals(conflicts,[{id:"a",choice:"skip"}])).toBe(false);
  expect(validateConflictApprovals(conflicts,[{id:"a",choice:"skip"},{id:"a",choice:"keep-device"}])).toBe(false);
  expect(validateConflictApprovals(conflicts,[{id:"a",choice:"skip"},{id:"b",choice:"keep-device"}])).toBe(true);
 });
 it("rejects foreign or malformed attachment paths",()=>{
  const household="11111111-1111-4111-8111-111111111111";
  const other="22222222-2222-4222-8222-222222222222";
  const asset="33333333-3333-4333-8333-333333333333";
  const result=cloudAttachmentPaths([{...item("a","Drill"),photo:"cloud-asset:"+household+"/"+asset,photos:["cloud-asset:"+other+"/"+asset]}],household);
  expect(result.paths).toEqual([household+"/"+asset]);
  expect(result.invalid).toBe(1);
 });
});
