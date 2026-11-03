import type { RevisionTransport, RevisionWriteResult } from "./syncRevision";

export type CloudRevisionRow<T>={item_id:string;payload:T;revision:string;deleted_at?:string|null};
export type CloudRevisionClient<T>={
 rpc:(name:string,args:{p_household:string;p_item:string;p_expected:string|null;p_payload:T})=>Promise<{data:string|null;error:{code?:string;message:string}|null}>;
 from:(table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{eq:(column:string,value:string)=>{maybeSingle:()=>Promise<{data:CloudRevisionRow<T>|null;error:{message:string}|null}>}}}};
};

export function createCloudRevisionApi<T>(client:CloudRevisionClient<T>,householdId:string){
 if(!householdId.trim())throw new Error("Household ID required");
 async function read(itemId:string):Promise<{revision:string;value:T}|null>{
  if(!itemId.trim())throw new Error("Item ID required");
  const {data,error}=await client.from("inventory_revisions").select("item_id,payload,revision,deleted_at").eq("household_id",householdId).eq("item_id",itemId).maybeSingle();
  if(error)throw new Error("Could not read cloud inventory revision");
  return data&&!data.deleted_at?{revision:data.revision,value:data.payload}:null;
 }
 const write:RevisionTransport<T>=async input=>{
  const {data,error}=await client.rpc("write_inventory_revision",{p_household:householdId,p_item:input.itemId,p_expected:input.expectedRevision,p_payload:input.value});
  if(error){
   if(error.code==="HV001"){
    const remote=await read(input.itemId);
    return {status:"conflict",revision:remote?.revision??null,remote:remote?.value??null};
   }
   throw new Error("Cloud inventory write failed");
  }
  if(typeof data!=="string"||!data.trim())throw new Error("Cloud server returned no revision");
  return {status:"saved",revision:data,value:input.value} satisfies RevisionWriteResult<T>;
 };
 return {read,write};
}
