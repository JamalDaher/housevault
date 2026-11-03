import { describe, expect, it } from "vitest";
import type { Item } from "./domain";
import { buildAttachmentManifest } from "./attachmentSync";
import { auditCloudRestoreAttachments } from "./syncRestoreAudit";
const item=(changes:Partial<Item>={}):Item=>({id:"a",name:"Drill",category:"Tools",location:"Garage",quantity:1,value:10,notes:"",...changes});
const a="data:image/png;base64,YQ==",b="data:image/png;base64,Yg==";
describe("cloud attachment restore completeness",()=>{
 it("accepts a complete verified set",async()=>{
  const remote=item({photo:a,photos:[b]});
  const blobs=await buildAttachmentManifest([remote]);
  expect(await auditCloudRestoreAttachments([remote],blobs.map(x=>({key:x.entry.key,data:x.data})))).toEqual({ready:true,verified:2});
 });
 it("rejects missing attachments even when the supplied subset is valid",async()=>{
  const remote=item({photo:a,photos:[b]});
  const blobs=await buildAttachmentManifest([remote]);
  const result=await auditCloudRestoreAttachments([remote],[{key:blobs[0].entry.key,data:blobs[0].data}]);
  expect(result).toEqual({ready:false,missing:[blobs[1].entry.key],corrupted:[],unexpected:[]});
 });
 it("rejects corrupted and extra downloads",async()=>{
  const remote=item({photo:a});
  const blobs=await buildAttachmentManifest([remote]);
  const result=await auditCloudRestoreAttachments([remote],[{key:blobs[0].entry.key,data:b},{key:"unknown",data:a}]);
  expect(result).toEqual({ready:false,missing:[],corrupted:[blobs[0].entry.key],unexpected:["unknown"]});
 });
 it("rejects repeated attachment keys instead of silently accepting replacements",async()=>{
  const remote=item({photo:a});
  const blobs=await buildAttachmentManifest([remote]);
  const result=await auditCloudRestoreAttachments([remote],[{key:blobs[0].entry.key,data:a},{key:blobs[0].entry.key,data:a}]);
  expect(result).toEqual({ready:false,missing:[],corrupted:[],unexpected:[blobs[0].entry.key]});
 });
 it("accepts inventories without attachments",async()=>{
  expect(await auditCloudRestoreAttachments([item()],[])).toEqual({ready:true,verified:0});
 });
});
