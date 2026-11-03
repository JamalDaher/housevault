import {describe,expect,it} from "vitest";
import {checkAuthorizedCloudReadiness} from "./cloudAuthorizedPreflight";
import type {CloudPreflightClient} from "./cloudRevisionPreflight";
const id="12345678-1234-1234-1234-123456789abc";
const client:CloudPreflightClient={from:()=>({select:()=>({eq:async()=>({count:0,error:null})})})};
describe("authorized cloud readiness",()=>{
 it("rejects a readable but unauthorized empty household",async()=>{
  const result=await checkAuthorizedCloudReadiness(client,{hasHouseholdAccess:async()=>false},id);
  expect(result.ready).toBe(false);expect(result.householdAccessible).toBe(false);
 });
 it("accepts an authorized empty household",async()=>{
  const result=await checkAuthorizedCloudReadiness(client,{hasHouseholdAccess:async()=>true},id);
  expect(result.ready).toBe(true);expect(result.recordCount).toBe(0);
 });
 it("fails closed if membership lookup fails",async()=>{
  const result=await checkAuthorizedCloudReadiness(client,{hasHouseholdAccess:async()=>{throw Error("offline");}},id);
  expect(result.ready).toBe(false);
 });
 it("rejects malformed IDs before access lookup",async()=>{
  let called=false;
  const result=await checkAuthorizedCloudReadiness(client,{hasHouseholdAccess:async()=>{called=true;return true;}},"not-a-uuid");
  expect(result.ready).toBe(false);expect(called).toBe(false);
 });
});
