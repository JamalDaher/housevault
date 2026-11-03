import type {Item} from "./domain";
import type {SyncBaseline} from "./syncBaselines";
import {prepareTombstoneRequest} from "./cloudTombstoneRequest";

type RpcClient={
 rpc:(name:string,args:{p_household:string;p_item:string;p_expected:string})=>Promise<{data:string|null;error:{code?:string;message:string}|null}>;
};

/** Explicitly confirmed request; caller must re-read local and remote state immediately before invoking. */
export async function submitConfirmedTombstone(input:{
 client:RpcClient;
 confirmed:boolean;
 householdId:string;
 itemId:string;
 local:Item|null;
 baseline:SyncBaseline|null;
 remote:{revision:string;value:Item}|null;
}):Promise<string>{
 if(!input.confirmed)throw new Error("Explicit confirmation required");
 const args=prepareTombstoneRequest(input.householdId,input.itemId,input.local,input.baseline,input.remote);
 if(!args)throw new Error("Deletion no longer eligible; refresh review");
 const {data,error}=await input.client.rpc("tombstone_inventory_revision",args);
 if(error?.code==="HV001")throw new Error("Cloud record changed; refresh review");
 if(error)throw new Error("Cloud deletion failed");
 if(typeof data!=="string"||!data.trim())throw new Error("Deletion response missing revision");
 return data;
}
