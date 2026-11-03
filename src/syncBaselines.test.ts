import {describe,expect,it} from "vitest";
import {canDownloadEdit,canUploadEdit,hasAttachments,sameItem,type SyncBaseline} from "./syncBaselines";
import type {Item} from "./domain";

const item=(name="Drill"):Item=>({id:"drill",name,category:"Tools",location:"Garage",quantity:1,value:100,notes:""});
const baseline=(value:Item=item(),revision="rev-1"):SyncBaseline=>({revision,value});
describe("automatic two-way edit safety",()=>{
 it("uploads only when remote still matches trusted revision",()=>{
  const original=item();
  const changed=item("Cordless drill");
  expect(canUploadEdit(changed,original,baseline(original),"rev-1")).toBe(true);
  expect(canUploadEdit(changed,original,baseline(original),"rev-2")).toBe(false);
  expect(canUploadEdit(changed,item("Other device"),baseline(original),"rev-1")).toBe(false);
  expect(canUploadEdit(original,original,baseline(original),"rev-1")).toBe(false);
 });
 it("downloads only when local still matches its baseline",()=>{
  const original=item();
  const changed=item("Cloud update");
  expect(canDownloadEdit(original,changed,baseline(original))).toBe(true);
  expect(canDownloadEdit(item("Local update"),changed,baseline(original))).toBe(false);
  expect(canDownloadEdit(original,original,baseline(original))).toBe(false);
 });
 it("blocks attachment loss from current, remote, or historical snapshots",()=>{
  const original=item();
  const changed=item("Updated");
  const withPhoto={...original,photo:"data:image/png;base64,AAAA"};
  const withPhotos={...original,photos:["data:image/png;base64,BBBB"]};
  const withDocument={...original,documents:[{id:"doc",name:"manual",data:"data:application/pdf;base64,AA"}]} as unknown as Item;
  for(const attached of [withPhoto,withPhotos,withDocument]){
   expect(hasAttachments(attached)).toBe(true);
   expect(canUploadEdit(changed,original,baseline(attached),"rev-1")).toBe(false);
   expect(canUploadEdit(changed,attached,baseline(original),"rev-1")).toBe(false);
   expect(canUploadEdit(attached,original,baseline(original),"rev-1")).toBe(false);
   expect(canDownloadEdit(original,changed,baseline(attached))).toBe(false);
   expect(canDownloadEdit(original,attached,baseline(original))).toBe(false);
   expect(canDownloadEdit(attached,changed,baseline(original))).toBe(false);
  }
 });
 it("does not confuse distinct inventory values",()=>{
  expect(sameItem(item(),item())).toBe(true);
  expect(sameItem(item(),{...item(),quantity:2})).toBe(false);
 });
});
