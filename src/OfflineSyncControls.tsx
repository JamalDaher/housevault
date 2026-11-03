import {useEffect,useState} from "react";
import type {Item} from "./domain";
import type {CloudRevisionClient} from "./cloudRevisionApi";
import {listPendingSync,refreshQueuedUpsert} from "./syncQueue";
import {syncSelectedHousehold} from "./syncSelectedHousehold";
import {loadInventory} from "./indexedStorage";
import {readSyncBaseline} from "./syncBaselines";
import {selectTrackedEdits} from "./selectTrackedEdits";
import {queueTrackedHouseholdEdits} from "./queueTrackedHouseholdEdits";

/** Manual-only queued edit delivery. No automatic upload or delete. */
export default function OfflineSyncControls({client,households}:{
 client:CloudRevisionClient<Item>;
 households:{id:string;name:string;created_by:string}[];
}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [autoQueue,setAutoQueue]=useState(false);
 const validHousehold=Boolean(household&&households.some(h=>h.id===household));
 useEffect(()=>{
  if(!autoQueue||!validHousehold)return;
  let active=true,running=false;
  const scan=async()=>{if(!active||running)return;running=true;try{await queueTrackedHouseholdEdits(household);}catch{if(active)setMessage("Automatic local queue scan failed; no cloud upload was attempted.");}finally{running=false;}};
  void scan();
  const timer=setInterval(()=>void scan(),30_000);
  return()=>{active=false;clearInterval(timer);};
 },[autoQueue,household,validHousehold]);
 async function inspect(){
  if(!household||busy)return;
  setBusy(true);setMessage("");
  try{
   const entries=await listPendingSync();
   const matching=entries.filter(entry=>entry.householdId===household);
   const legacy=entries.filter(entry=>!entry.householdId);
   setMessage(matching.length+" pending for selected household. "+legacy.length+" older unscoped changes require review.");
  }catch{setMessage("Unable to inspect the local queue. No cloud changes were sent.");}
  finally{setBusy(false);}
 }
 async function queueEdits(){
  if(!household||busy)return;
  setBusy(true);setMessage("");
  try{
   if(!window.confirm("Queue changed, previously synchronized inventory records for this household? No upload occurs until you select Send queued edits."))return;
   const count=await queueTrackedHouseholdEdits(household);
   setMessage(count+" tracked edits queued locally. New items, attachments and deletions are excluded.");
  }catch{setMessage("Could not prepare offline edits. No cloud changes were sent.");}
  finally{setBusy(false);}
 }
 async function refreshEdits(){
  if(!household||busy)return;
  setBusy(true);setMessage("");
  try{
   const local=await loadInventory();
   const pending=(await listPendingSync()).filter(e=>e.householdId===household&&e.operation==="upsert");
   const current=new Map(local.map(item=>[item.id,item]));
   const updates:Item[]=[];
   for(const entry of pending){
    const item=current.get(entry.itemId);
    if(!item||item.id.startsWith("demo-")||item.id.startsWith("__housevault_test_"))continue;
    const baseline=await readSyncBaseline(household,item.id);
    if(!baseline)continue;
    const eligible=selectTrackedEdits({items:[item],baselines:new Map([[item.id,baseline]]),queuedIds:new Set()});
    if(eligible.length)updates.push(item);
   }
   if(!updates.length){setMessage("No eligible pending edits need refreshing.");return;}
   if(!window.confirm("Refresh "+updates.length+" queued edit snapshots from current local inventory? No cloud upload occurs."))return;
   let refreshed=0;
   for(const item of updates)if(await refreshQueuedUpsert(household,item.id,item))refreshed++;
   setMessage(refreshed+" queued edits refreshed. Leased or ambiguous entries were left unchanged.");
  }catch{setMessage("Could not refresh pending edits; the queue was not uploaded.");}
  finally{setBusy(false);}
 }
 async function send(){
  if(!household||!households.some(h=>h.id===household)||busy)return;
  if(!window.confirm("Send queued attachment-free edits to this household? Conflicts will be preserved for review. No deletions will be sent."))return;
  setBusy(true);setMessage("");
  try{
   const result=await syncSelectedHousehold(client,household);
   const detail=result.stopped==="deferred"?"Queued edits are waiting for their retry window.":result.stopped==="conflict"?"A cloud conflict needs review before retrying.":result.stopped==="offline"?"Device is offline; nothing further was sent.":result.stopped==="failed"?"Delivery failed; the queued edit was retained for retry.":result.stopped==="limit"?"Batch limit reached; more changes are queued.":result.remaining?"Some queued work remains.":"No pending work for this household.";
   setMessage(result.sent+" sent; "+result.failed+" failed. "+detail);
  }catch{setMessage("Could not synchronize. Queued changes remain stored on this device.");}
  finally{setBusy(false);}
 }
 return <div className="account-card">
  <h3>Offline sync queue (beta)</h3>
  <p>Manual delivery only. Select a household to inspect its pending changes. Attachments and deletions are not uploaded here.</p>
  <label htmlFor="offline-sync-household">Destination household</label>
  <select id="offline-sync-household" value={household} onChange={e=>{setAutoQueue(false);setHousehold(e.target.value);setMessage("");}}>
   <option value="">Choose household</option>
   {households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
  </select>
  <label><input type="checkbox" checked={autoQueue} disabled={!household||busy} onChange={e=>setAutoQueue(e.target.checked)}/> Automatically queue tracked edits on this device while this account page is open (no automatic upload)</label>
  <button type="button" disabled={!household||busy} onClick={()=>void queueEdits()}>Queue tracked local edits</button>
  <button type="button" disabled={!household||busy} onClick={()=>void inspect()}>Inspect queue</button>
  <button type="button" disabled={!household||busy} onClick={()=>void refreshEdits()}>Refresh queued edits</button>
  <button type="button" disabled={!household||busy} onClick={()=>void send()}>{busy?"Sending…":"Send queued edits"}</button>
  {message&&<p role="status">{message}</p>}
 </div>;
}
