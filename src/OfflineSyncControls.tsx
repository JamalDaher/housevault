import {useState} from "react";
import type {Item} from "./domain";
import type {CloudRevisionClient} from "./cloudRevisionApi";
import {listPendingSync} from "./syncQueue";
import {syncSelectedHousehold} from "./syncSelectedHousehold";
import {loadInventory} from "./indexedStorage";
import {readSyncBaseline,sameItem,hasAttachments} from "./syncBaselines";
import {enqueueSync} from "./syncQueue";

/** Manual-only queued edit delivery. No automatic upload or delete. */
export default function OfflineSyncControls({client,households}:{
 client:CloudRevisionClient<Item>;
 households:{id:string;name:string;created_by:string}[];
}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function inspect(){
  const entries=await listPendingSync();
  const matching=entries.filter(entry=>entry.householdId===household);
  const legacy=entries.filter(entry=>!entry.householdId);
  setMessage(matching.length+" pending for selected household. "+legacy.length+" older unscoped changes require review.");
 }
 async function queueEdits(){
  if(!household||busy)return;
  setBusy(true);setMessage("");
  try{
   const local=await loadInventory();
   const pending=await listPendingSync();
   const queued=new Set(pending.filter(e=>e.householdId===household).map(e=>e.itemId));
   const eligible:Item[]=[];
   for(const item of local){
    if(item.id.startsWith("demo-")||item.id.startsWith("__housevault_test_")||hasAttachments(item)||queued.has(item.id))continue;
    const baseline=await readSyncBaseline(household,item.id);
    if(baseline&&!sameItem(baseline.value,item))eligible.push(item);
   }
   if(!eligible.length){setMessage("No eligible tracked edits to queue. New items, attachments and deletions are excluded.");return;}
   if(!window.confirm("Queue "+eligible.length+" tracked inventory edits for this household? No network upload occurs until you select Send queued edits."))return;
   for(const item of eligible)await enqueueSync(item.id,"upsert",item,Date.now(),household);
   setMessage(eligible.length+" tracked edits saved to the offline queue. Review before sending.");
  }catch{setMessage("Could not prepare offline edits. No cloud changes were sent.");}
  finally{setBusy(false);}
 }
 async function send(){
  if(!household||!households.some(h=>h.id===household)||busy)return;
  if(!window.confirm("Send queued attachment-free edits to this household? Conflicts will be preserved for review. No deletions will be sent."))return;
  setBusy(true);setMessage("");
  try{
   const result=await syncSelectedHousehold(client,household);
   setMessage(result.sent+" sent; "+result.failed+" failed. "+(result.remaining?"Some queued work remains.":"No pending work for this household.")+" Status: "+result.stopped+".");
  }catch{setMessage("Could not synchronize. Queued changes remain stored on this device.");}
  finally{setBusy(false);}
 }
 return <div className="account-card">
  <h3>Offline sync queue (beta)</h3>
  <p>Manual delivery only. Select a household to inspect its pending changes. Attachments and deletions are not uploaded here.</p>
  <label htmlFor="offline-sync-household">Destination household</label>
  <select id="offline-sync-household" value={household} onChange={e=>{setHousehold(e.target.value);setMessage("");}}>
   <option value="">Choose household</option>
   {households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
  </select>
  <button type="button" disabled={!household||busy} onClick={()=>void queueEdits()}>Queue tracked local edits</button>
  <button type="button" disabled={!household||busy} onClick={()=>void inspect()}>Inspect queue</button>
  <button type="button" disabled={!household||busy} onClick={()=>void send()}>{busy?"Sending…":"Send queued edits"}</button>
  {message&&<p role="status">{message}</p>}
 </div>;
}
