import { describe, expect, it } from "vitest";
import type { Item } from "./domain";
import { buildAttachmentManifest, pendingAttachmentUploads, verifyAttachment } from "./attachmentSync";
const data=(base64:string)=>"data:image/png;base64,"+base64;
const item=(extra:Partial<Item>={}):Item=>({id:"tool-1",name:"Drill",category:"Tools",location:"Garage",quantity:1,value:50,notes:"",...extra});
describe("attachment sync integrity",()=>{
 it("creates stable digests for covers, photos and documents",async()=>{
  const source=item({photo:data("YQ=="),photos:[data("Yg==")],documents:[{id:"manual",name:"Manual",type:"image/png",data:data("Yw==")}]});
  const first=await buildAttachmentManifest([source]);
  const second=await buildAttachmentManifest([source]);
  expect(first.map(x=>x.entry)).toEqual(second.map(x=>x.entry));
  expect(first.map(x=>x.entry.kind)).toEqual(["cover","photo","document"]);
  expect(first.every(x=>x.entry.bytes===1&&x.entry.sha256.length===64)).toBe(true);
 });
 it("detects corruption and wrong MIME type before applying a downloaded blob",async()=>{
  const [blob]=await buildAttachmentManifest([item({photo:data("YQ==")})]);
  expect(await verifyAttachment(blob.entry,blob.data)).toBe(true);
  expect(await verifyAttachment(blob.entry,data("Yg=="))).toBe(false);
  expect(await verifyAttachment(blob.entry,"data:image/jpeg;base64,YQ==")).toBe(false);
  expect(await verifyAttachment(blob.entry,"not-a-data-url")).toBe(false);
 });
 it("only schedules missing content for upload",async()=>{
  const blobs=await buildAttachmentManifest([item({photo:data("YQ=="),photos:[data("Yg==")]})]);
  expect(pendingAttachmentUploads(blobs.map(x=>x.entry),[blobs[0].entry])).toEqual([blobs[1].entry]);
 });
 it("rejects duplicate attachment identities",async()=>{
  const source=item({documents:[{id:"same",name:"One",type:"image/png",data:data("YQ==")},{id:"same",name:"Two",type:"image/png",data:data("Yg==")}]});
  await expect(buildAttachmentManifest([source])).rejects.toThrow("Duplicate");
 });
});
