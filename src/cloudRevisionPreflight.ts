/** Read-only checks before enabling the revisioned cloud inventory integration.
 * This module never writes data or enables synchronization.
 */
export type CloudPreflightClient={
 from:(table:string)=>{select:(columns:string,options:{head:true;count:"exact"})=>{eq:(column:string,value:string)=>Promise<{count:number|null;error:{message:string}|null}>}};
};
export type CloudPreflightResult={ready:boolean;householdAccessible:boolean;recordCount:number|null;issues:string[]};
export async function checkCloudRevisionReadiness(client:CloudPreflightClient,householdId:string):Promise<CloudPreflightResult>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(householdId)){
  return {ready:false,householdAccessible:false,recordCount:null,issues:["Select a valid household before checking cloud storage."]};
 }
 try{
  const {count,error}=await client.from("inventory_revisions").select("item_id",{head:true,count:"exact"}).eq("household_id",householdId);
  if(error)return {ready:false,householdAccessible:false,recordCount:null,issues:["Cloud revision storage is unavailable or access was denied."]};
  if(count===null)return {ready:false,householdAccessible:false,recordCount:null,issues:["Cloud revision record count could not be verified."]};
  return {ready:true,householdAccessible:true,recordCount:count,issues:[]};
 }catch{
  return {ready:false,householdAccessible:false,recordCount:null,issues:["Could not contact cloud revision storage."]};
 }
}
