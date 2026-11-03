import type {HouseholdAccessReader} from "./cloudAuthorizedPreflight";

/** Uses the authenticated Supabase client, not a caller-supplied role flag. */
export type MembershipQuery={
 from:(table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{eq:(column:string,value:string)=>{maybeSingle:()=>Promise<{data:Record<string,unknown>|null;error:{message:string}|null}>}}}};
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createHouseholdAccessReader(client:MembershipQuery,userId:string):HouseholdAccessReader{
 if(!UUID.test(userId))throw new Error("Authenticated user ID required");
 return {async hasHouseholdAccess(householdId:string){
  if(!UUID.test(householdId))return false;
  const owner=await client.from("households").select("id").eq("id",householdId).eq("created_by",userId).maybeSingle();
  if(owner.error)throw new Error("Could not verify household ownership");
  if(owner.data)return true;
  const member=await client.from("household_members").select("household_id").eq("household_id",householdId).eq("user_id",userId).maybeSingle();
  if(member.error)throw new Error("Could not verify household membership");
  return member.data!==null;
 }};
}
