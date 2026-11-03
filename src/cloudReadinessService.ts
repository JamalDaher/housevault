import {checkAuthorizedCloudReadiness} from "./cloudAuthorizedPreflight";
import {createHouseholdAccessReader,type MembershipQuery} from "./cloudHouseholdAccess";
import type {CloudPreflightClient,CloudPreflightResult} from "./cloudRevisionPreflight";

/** Read-only integration point. No remote writes, migration, or sync activation. */
export type CloudReadinessDatabase=MembershipQuery&CloudPreflightClient;
export async function inspectHouseholdCloudReadiness(
 client:CloudReadinessDatabase,userId:string,householdId:string
):Promise<CloudPreflightResult>{
 try{
  const access=createHouseholdAccessReader(client,userId);
  return await checkAuthorizedCloudReadiness(client,access,householdId);
 }catch{
  return {ready:false,householdAccessible:false,recordCount:null,issues:["Unable to verify your account and household cloud access."]};
 }
}
