import {describe,expect,it} from "vitest";
import {inspectHouseholdCloudReadiness,type CloudReadinessDatabase} from "./cloudReadinessService";
const user="12345678-1234-1234-1234-123456789abc",house="87654321-4321-4321-4321-cba987654321";
function database(owner:boolean,member:boolean,count:number|null=0):CloudReadinessDatabase{
 return ({from:(table:string)=>({
  select:((columns:string,options?:{head:true;count:"exact"})=>{
   if(options)return {eq:async()=>({count,error:null})};
   return {eq:()=>({eq:()=>({maybeSingle:async()=>({data:table==="households"?(owner?{id:house}:null):(member?{household_id:house}:null),error:null})})})};
  })
 })}) as unknown as CloudReadinessDatabase;
}
describe("cloud readiness integration",()=>{
 it("allows authorized owners to inspect empty cloud storage",async()=>{
  expect(await inspectHouseholdCloudReadiness(database(true,false),user,house)).toMatchObject({ready:true,recordCount:0});
 });
 it("allows authorized members",async()=>{
  expect((await inspectHouseholdCloudReadiness(database(false,true,2),user,house)).recordCount).toBe(2);
 });
 it("does not query revision counts for unauthorized households",async()=>{
  const result=await inspectHouseholdCloudReadiness(database(false,false),user,house);
  expect(result.ready).toBe(false);expect(result.householdAccessible).toBe(false);
 });
 it("fails closed when no valid authenticated user is available",async()=>{
  expect((await inspectHouseholdCloudReadiness(database(true,false),"invalid",house)).ready).toBe(false);
 });
});
