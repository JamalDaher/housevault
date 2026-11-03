import {describe,expect,it} from "vitest";
import {createHouseholdAccessReader,type MembershipQuery} from "./cloudHouseholdAccess";
const user="12345678-1234-1234-1234-123456789abc",house="87654321-4321-4321-4321-cba987654321";
function client(owner:boolean,member:boolean,fail=false):MembershipQuery{
 return {from:(table)=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:table==="households"?(owner?{id:house}:null):(member?{household_id:house}:null),error:fail?{message:"denied"}:null})})})})})};
}
describe("household membership reader",()=>{
 it("accepts an owner",async()=>{expect(await createHouseholdAccessReader(client(true,false),user).hasHouseholdAccess(house)).toBe(true);});
 it("accepts a member",async()=>{expect(await createHouseholdAccessReader(client(false,true),user).hasHouseholdAccess(house)).toBe(true);});
 it("rejects an unrelated household",async()=>{expect(await createHouseholdAccessReader(client(false,false),user).hasHouseholdAccess(house)).toBe(false);});
 it("fails closed on database errors",async()=>{await expect(createHouseholdAccessReader(client(false,false,true),user).hasHouseholdAccess(house)).rejects.toThrow("verify");});
 it("rejects invalid identifiers",async()=>{expect(()=>createHouseholdAccessReader(client(false,false),"bad")).toThrow("user ID");expect(await createHouseholdAccessReader(client(false,false),user).hasHouseholdAccess("bad")).toBe(false);});
});
