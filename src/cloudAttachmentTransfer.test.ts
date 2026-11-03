import {describe,expect,it} from "vitest";
import {buildAttachmentManifest} from "./attachmentSync";
import {attachmentStoragePath,downloadVerifiedAttachment,uploadVerifiedAttachment} from "./cloudAttachmentTransfer";
import type {Item} from "./domain";
const household="12345678-1234-1234-1234-123456789abc";
const item={id:"lamp",name:"Lamp",category:"Home",location:"Office",quantity:1,value:10,notes:"",photo:"data:image/png;base64,YQ=="} as Item;
describe("verified attachment transfer",()=>{
 it("uploads and downloads using household-scoped content digest",async()=>{
  const [blob]=await buildAttachmentManifest([item]);
  const stored=new Map<string,string>();
  const storage={upload:async(path:string,data:string)=>{stored.set(path,data);},download:async(path:string)=>stored.get(path)??""};
  const path=await uploadVerifiedAttachment(storage,household,blob);
  expect(path).toBe(household+"/"+blob.entry.sha256);
  expect(await downloadVerifiedAttachment(storage,household,blob.entry)).toBe(blob.data);
 });
 it("rejects corrupted downloads",async()=>{
  const [blob]=await buildAttachmentManifest([item]);
  const storage={upload:async()=>{},download:async()=> "data:image/png;base64,Yg=="};
  await expect(downloadVerifiedAttachment(storage,household,blob.entry)).rejects.toThrow("integrity");
 });
 it("rejects corrupted uploads before transport",async()=>{
  const [blob]=await buildAttachmentManifest([item]);let called=false;
  const storage={upload:async()=>{called=true;},download:async()=>""};
  await expect(uploadVerifiedAttachment(storage,household,{...blob,data:"data:image/png;base64,Yg=="})).rejects.toThrow("integrity");
  expect(called).toBe(false);
 });
 it("rejects malformed household IDs and digests",async()=>{
  const [blob]=await buildAttachmentManifest([item]);
  expect(()=>attachmentStoragePath("../outside",blob.entry)).toThrow("household");
  expect(()=>attachmentStoragePath(household,{...blob.entry,sha256:"oops"})).toThrow("digest");
 });
});
