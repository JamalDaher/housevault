import type {Item} from "./domain";
import {planCloudDeletion} from "./cloudDeletionPlan";
import type {SyncBaseline} from "./syncBaselines";

export function prepareTombstoneRequest(householdId:string,itemId:string,local:Item|null,baseline:SyncBaseline|null,remote:{revision:string;value:Item}|null){
 if(!householdId.trim())throw new Error("Household required");
 const decision=planCloudDeletion({itemId,local,baseline,remote});
 if(decision.kind!=="eligible")return null;
 return {p_household:householdId,p_item:itemId,p_expected:decision.expectedRevision};
}
