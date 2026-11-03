import type {Item} from "./domain";
import type {SyncBaseline} from "./syncBaselines";

/** Only never-synced, attachment-free items may be created in cloud.
 * Previously synced records missing from cloud may have been deleted remotely.
 */
export function canCreateCloudCopy(item:Item,cloudHasItem:boolean,baseline:SyncBaseline|null):boolean{
 return !cloudHasItem&&!baseline&&!item.id.startsWith("demo-")&&!item.id.startsWith("__housevault_test_")&&
  !item.photo&&!item.photos?.length&&!item.documents?.length;
}
