import type {Item} from "./domain";
import type {SyncBaseline} from "./syncBaselines";
import {hasAttachments,sameItem} from "./syncBaselines";

/** Pure selection: only previously tracked, attachment-free edits are eligible. */
export function selectTrackedEdits(input:{
 items:Item[];
 baselines:Map<string,SyncBaseline|null>;
 queuedIds:ReadonlySet<string>;
}):Item[]{
 const seen=new Set<string>();
 return input.items.filter(item=>{
  if(!item.id.trim()||seen.has(item.id))return false;
  seen.add(item.id);
  if(item.id.startsWith("demo-")||item.id.startsWith("__housevault_test_")||hasAttachments(item)||input.queuedIds.has(item.id))return false;
  const baseline=input.baselines.get(item.id);
  return Boolean(baseline&&baseline.revision.trim()&&baseline.value.id===item.id&&!sameItem(baseline.value,item));
 });
}
