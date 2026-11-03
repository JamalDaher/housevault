import type {Item} from "./domain";
export type DeletedCloudRow={item_id:string;revision:string;deleted_at:string|null;payload:Item};
export function eligibleRestore(row:DeletedCloudRow):boolean{
 return Boolean(row.item_id.trim()&&row.revision.trim()&&row.deleted_at&&row.payload?.id===row.item_id);
}
export async function requestCloudRestore(
 client:{rpc:(name:string,args:{p_household:string;p_item:string;p_expected:string})=>Promise<{data:string|null;error:{code?:string;message:string}|null}>},
 householdId:string,row:DeletedCloudRow,confirmed:boolean
):Promise<string>{
 if(!confirmed)throw new Error("Restore requires confirmation");
 if(!householdId.trim()||!eligibleRestore(row))throw new Error("Invalid restore candidate");
 const {data,error}=await client.rpc("restore_inventory_revision",{p_household:householdId,p_item:row.item_id,p_expected:row.revision});
 if(error?.code==="HV001")throw new Error("Cloud record changed; refresh review");
 if(error)throw new Error("Cloud restore failed");
 if(!data?.trim())throw new Error("Restore response missing revision");
 return data;
}
