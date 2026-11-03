import { describe, expect, it } from "vitest";
import { CloudRevisionConflict, saveWithRevision, type RevisionWrite } from "./syncRevision";
type RecordData={name:string};
const write:RevisionWrite<RecordData>={itemId:"a",expectedRevision:"v1",value:{name:"Local"}};
describe("cloud revision safety contract",()=>{
 it("passes the expected revision to transport and returns the new revision",async()=>{
  const result=await saveWithRevision(write,async request=>{
   expect(request.expectedRevision).toBe("v1");
   return {status:"saved",revision:"v2",value:request.value};
  });
  expect(result).toEqual({revision:"v2",value:{name:"Local"}});
 });
 it("surfaces remote edits instead of overwriting or automatically retrying",async()=>{
  let calls=0;
  await expect(saveWithRevision(write,async()=>{
   calls++;
   return {status:"conflict",revision:"v3",remote:{name:"Other device"}};
  })).rejects.toMatchObject({name:"CloudRevisionConflict",revision:"v3",remote:{name:"Other device"}});
  expect(calls).toBe(1);
 });
 it("supports create-if-absent using a null expected revision",async()=>{
  const result=await saveWithRevision({...write,expectedRevision:null},async request=>{
   expect(request.expectedRevision).toBeNull();
   return {status:"saved",revision:"v1",value:request.value};
  });
  expect(result.revision).toBe("v1");
 });
 it("rejects invalid IDs and missing server revisions",async()=>{
  await expect(saveWithRevision({...write,itemId:" "},async()=>{throw Error("Should not send");})).rejects.toThrow("Item ID");
  await expect(saveWithRevision(write,async()=>({status:"saved",revision:"",value:write.value}))).rejects.toThrow("empty revision");
 });
 it("preserves the caller's payload when transport mutates its argument",async()=>{
  await saveWithRevision(write,async request=>{
   request.value.name="Changed by transport";
   return {status:"saved",revision:"v2",value:request.value};
  });
  expect(write.value.name).toBe("Local");
  expect(new CloudRevisionConflict(null,null)).toBeInstanceOf(Error);
 });
});
