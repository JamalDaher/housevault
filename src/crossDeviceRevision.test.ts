import {describe,expect,it} from "vitest";
import {CloudRevisionConflict,saveWithRevision,type RevisionTransport} from "./syncRevision";

type Item={name:string};
function server(){
 let revision:string|null=null;
 let value:Item|null=null;
 let sequence=0;
 const transport:RevisionTransport<Item>=async write=>{
  if(write.expectedRevision!==revision)return {status:"conflict",revision,remote:value&&structuredClone(value)};
  revision="revision-"+(++sequence);
  value=structuredClone(write.value);
  return {status:"saved",revision,value:structuredClone(value)};
 };
 const read=async()=>({revision,value:value&&structuredClone(value)});
 return {transport,read};
}
describe("two-device revision reconciliation gate",()=>{
 it("rejects stale device B after device A updates, preserving both copies",async()=>{
  const cloud=server();
  const initial=await saveWithRevision({itemId:"item",expectedRevision:null,value:{name:"Original"}},cloud.transport);
  const aLocal={name:"Device A edit"};
  const bLocal={name:"Device B edit"};
  const a=await saveWithRevision({itemId:"item",expectedRevision:initial.revision,value:aLocal},cloud.transport);
  await expect(saveWithRevision({itemId:"item",expectedRevision:initial.revision,value:bLocal},cloud.transport)).rejects.toMatchObject({
   name:"CloudRevisionConflict",revision:a.revision,remote:aLocal
  });
  expect((await cloud.read()).value).toEqual(aLocal);
  expect(bLocal).toEqual({name:"Device B edit"});
 });
 it("allows B to save after explicit revision refresh without silent overwrite",async()=>{
  const cloud=server();
  const a=await saveWithRevision({itemId:"item",expectedRevision:null,value:{name:"A"}},cloud.transport);
  const bRead=await cloud.read();
  expect(bRead.revision).toBe(a.revision);
  const b=await saveWithRevision({itemId:"item",expectedRevision:bRead.revision,value:{name:"B"}},cloud.transport);
  expect((await cloud.read()).value).toEqual({name:"B"});
  expect(b.revision).not.toBe(a.revision);
 });
 it("does not automatically resolve a stale conflict",async()=>{
  const cloud=server();
  await saveWithRevision({itemId:"item",expectedRevision:null,value:{name:"Remote"}},cloud.transport);
  let writes=0;
  const counting:RevisionTransport<Item>=async input=>{writes++;return cloud.transport(input);};
  await expect(saveWithRevision({itemId:"item",expectedRevision:null,value:{name:"Local"}},counting)).rejects.toBeInstanceOf(CloudRevisionConflict);
  expect(writes).toBe(1);
  expect((await cloud.read()).value).toEqual({name:"Remote"});
 });
});
