import {describe,expect,it} from "vitest";
import {createCloudRevisionApi,type CloudRevisionClient} from "./cloudRevisionApi";
type Data={name:string};
function mock(rpc:CloudRevisionClient<Data>["rpc"],row:{item_id:string;payload:Data;revision:string;deleted_at?:string|null}|null=null):CloudRevisionClient<Data>{
 return {rpc,from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})})})};
}
describe("cloud revision API",()=>{
 it("sends expected revision to atomic server RPC",async()=>{
  const api=createCloudRevisionApi(mock(async(name,args)=>{
   expect(name).toBe("write_inventory_revision");
   expect(args).toEqual({p_household:"home",p_item:"item",p_expected:"old",p_payload:{name:"Desk"}});
   return {data:"new",error:null};
  }),"home");
  expect(await api.write({itemId:"item",expectedRevision:"old",value:{name:"Desk"}})).toEqual({status:"saved",revision:"new",value:{name:"Desk"}});
 });
 it("reads existing remote revisions",async()=>{
  const api=createCloudRevisionApi(mock(async()=>({data:null,error:null}),{item_id:"item",payload:{name:"Remote"},revision:"r2"}),"home");
  expect(await api.read("item")).toEqual({revision:"r2",value:{name:"Remote"}});
 });
 it("distinguishes deleted cloud records from never-created records",async()=>{
  const api=createCloudRevisionApi(mock(async()=>({data:null,error:null}),{item_id:"item",payload:{name:"Deleted"},revision:"r4",deleted_at:"2026-11-03T00:00:00Z"}),"home");
  expect(await api.read("item")).toBeNull();
  expect(await api.readIncludingTombstone("item")).toEqual({revision:"r4",value:{name:"Deleted"},deleted:true});
 });
 it("returns remote data on a conflict instead of retrying writes",async()=>{
  let calls=0;
  const api=createCloudRevisionApi(mock(async()=>{calls++;return {data:null,error:{code:"HV001",message:"conflict"}};},{item_id:"item",payload:{name:"Other"},revision:"r3"}),"home");
  expect(await api.write({itemId:"item",expectedRevision:"r1",value:{name:"Local"}})).toEqual({status:"conflict",revision:"r3",remote:{name:"Other"}});
  expect(calls).toBe(1);
 });
 it("fails closed for unrelated server errors",async()=>{
  const api=createCloudRevisionApi(mock(async()=>({data:null,error:{code:"42501",message:"denied"}})),"home");
  await expect(api.write({itemId:"item",expectedRevision:null,value:{name:"Local"}})).rejects.toThrow("write failed");
 });
});
