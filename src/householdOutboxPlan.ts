import type {Item} from "./domain";
import {diffLocalInventory} from "./localChangeDiff";
import type {SyncBaseline} from "./syncBaselines";

/** Build a conservative batch for an explicitly selected household.
 * Only items already trusted for this household may be queued as edits/deletes.
 * New records require explicit create opt-in. No attachment payloads are included.
 */
export function planHouseholdOutbox(input:{
 householdId:string;
 previous:Item[];
 current:Item[];
 baselines:Map<string,SyncBaseline>;
 allowCreates:boolean;
 allowDeletes:boolean;
}){
 if(!input.householdId.trim())throw new Error("Select a household before preparing synchronization");
 const changes=diffLocalInventory(input.previous,input.current);
 return changes.filter(change=>{
  const baseline=input.baselines.get(change.itemId);
  if(change.operation==="delete")return input.allowDeletes&&Boolean(baseline);
  if(baseline)return true;
  return input.allowCreates;
 });
}
