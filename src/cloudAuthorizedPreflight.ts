import {checkCloudRevisionReadiness,type CloudPreflightClient,type CloudPreflightResult} from "./cloudRevisionPreflight";

/** A zero-row RLS query is not proof of household membership.
 * Verify access independently before interpreting revision counts.
 */
export type HouseholdAccessReader={
 hasHouseholdAccess:(householdId:string)=>Promise<boolean>;
};
export async function checkAuthorizedCloudReadiness(
 client:CloudPreflightClient,access:HouseholdAccessReader,householdId:string
):Promise<CloudPreflightResult>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(householdId)){
  return {ready:false,householdAccessible:false,recordCount:null,issues:["Select a valid household before checking cloud storage."]};
 }
 try{
  if(!await access.hasHouseholdAccess(householdId)){
   return {ready:false,householdAccessible:false,recordCount:null,issues:["You do not have access to this household."]};
  }
 }catch{
  return {ready:false,householdAccessible:false,recordCount:null,issues:["Could not verify household membership."]};
 }
 return checkCloudRevisionReadiness(client,householdId);
}
