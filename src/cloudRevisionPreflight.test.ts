import {describe,expect,it} from "vitest";
import {checkCloudRevisionReadiness,type CloudPreflightClient} from "./cloudRevisionPreflight";
const household="12345678-1234-1234-1234-123456789abc";
function client(result:{count:number|null;error:{message:string}|null}):CloudPreflightClient{
 return {from:(table)=>{expect(table).toBe("inventory_revisions");return {select:(columns,options)=>{
  expect(columns).toBe("item_id");expect(options).toEqual({head:true,count:"exact"});
  return {eq:async(column,value)=>{expect(column).toBe("household_id");expect(value).toBe(household);return result;}};
 }};}};
}
describe("cloud revision preflight",()=>{
 it("reports a readable empty household as ready",async()=>{
  expect(await checkCloudRevisionReadiness(client({count:0,error:null}),household)).toEqual({ready:true,householdAccessible:true,recordCount:0,issues:[]});
 });
 it("does not confuse missing permissions with an empty household",async()=>{
  const result=await checkCloudRevisionReadiness(client({count:null,error:{message:"denied"}}),household);
  expect(result.ready).toBe(false);expect(result.recordCount).toBeNull();
 });
 it("rejects invalid household IDs before a query",async()=>{
  const result=await checkCloudRevisionReadiness({from:()=>{throw new Error("unexpected query");}},"../other");
  expect(result.ready).toBe(false);
 });
 it("fails closed on network errors",async()=>{
  const result=await checkCloudRevisionReadiness({from:()=>{throw new Error("offline");}},household);
  expect(result.ready).toBe(false);
 });
});
