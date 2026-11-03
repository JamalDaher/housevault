import {useEffect,useRef,useState} from "react";
import CloudRecovery from "./CloudRecovery";
import {loadInventory} from "./indexedStorage";
import {buildDeletionReview} from "./cloudDeletionReview";
import {submitConfirmedTombstone} from "./cloudTombstoneApi";
import type {SyncBaseline} from "./syncBaselines";
import {fetchCloudInventory,uploadNewCloudItem} from "./cloudInventoryTransfer";
import {createCloudRevisionApi} from "./cloudRevisionApi";
import {CloudRevisionConflict,saveWithRevision} from "./syncRevision";
import {readSyncBaseline,saveSyncBaseline,sameItem,canUploadEdit,canDownloadEdit} from "./syncBaselines";
import type {Item} from "./domain";

type Client=Parameters<typeof fetchCloudInventory>[0]&Parameters<typeof createCloudRevisionApi<Item>>[0]&Parameters<typeof submitConfirmedTombstone>[0]["client"];
type Household={id:string;name:string};
export default function AutomaticCloudPull({client,households,onImportCloudItem,onReplaceCloudItem}:{client:Client;households:Household[];onImportCloudItem:(item:Item)=>Promise<void>;onReplaceCloudItem:(item:Item,expected:Item)=>Promise<void>}){
 const [household,setHousehold]=useState("");
 const [enabled,setEnabled]=useState(false);
 const [status,setStatus]=useState("Disabled — no automatic changes.");
 const [busy,setBusy]=useState(false);
 const [uploadEnabled,setUploadEnabled]=useState(false);
 const [divergent,setDivergent]=useState<string[]>([]);
 const [editEnabled,setEditEnabled]=useState(false);
 const [pullEdits,setPullEdits]=useState(false);
 const [missingLocally,setMissingLocally]=useState<string[]>([]);
 const [deletionReview,setDeletionReview]=useState<{itemId:string;name:string;kind:string}[]>([]);
 const [deletionBusy,setDeletionBusy]=useState(false);
 const inFlight=useRef(false);
 const [syncEpoch,setSyncEpoch]=useState(0);
 const householdKey=households.map(h=>h.id).join("|");
 const importCallback=useRef(onImportCloudItem);
 importCallback.current=onImportCloudItem;
 const replaceCallback=useRef(onReplaceCloudItem);
 replaceCallback.current=onReplaceCloudItem;
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setEnabled(false);setUploadEnabled(false);setEditEnabled(false);setPullEdits(false);setDivergent([]);setMissingLocally([]);setDeletionReview([]);setStatus("Disabled — no automatic changes.");},[client]);
 useEffect(()=>{
  if(!enabled||!households.some(h=>h.id===household))return;
  let active=true;
  const token=++generation.current;
  async function tick(){
   if(inFlight.current||!active)return;
   if(navigator.onLine===false){setStatus("Offline — waiting for connection.");return;}
   inFlight.current=true;setBusy(true);
   try{
    const remote=await fetchCloudInventory(client,household);
    if(!active||generation.current!==token)return;
    const local=await loadInventory();
    const ids=new Set(local.map(i=>i.id));
    const localById=new Map(local.map(i=>[i.id,i]));
    let edited=0;
    let downloadedEdits=0;
    const revisionApi=createCloudRevisionApi<Item>(client,household);
    const differences:string[]=[];
    for(const row of remote){
     if(!active||generation.current!==token)break;
     const device=localById.get(row.itemId);
     if(!device)continue;
     const baseline=await readSyncBaseline(household,row.itemId);
     if(!active||generation.current!==token)break;
     if(sameItem(device,row.value)){
      if(!baseline||baseline.revision!==row.revision||!sameItem(baseline.value,row.value))await saveSyncBaseline(household,row.itemId,{revision:row.revision,value:structuredClone(row.value)});
      continue;
     }
     if(editEnabled&&baseline&&canUploadEdit(device,row.value,baseline,row.revision)){
      const latest=(await loadInventory()).find(i=>i.id===row.itemId);
      if(!active||generation.current!==token)break;
      if(latest&&sameItem(latest,device)){
       try{
        if(!active||generation.current!==token)break;
        const result=await saveWithRevision({itemId:device.id,expectedRevision:row.revision,value:structuredClone(device)},revisionApi.write);
        await saveSyncBaseline(household,device.id,{revision:result.revision,value:structuredClone(device)});
        edited++;continue;
       }catch(error){if(!(error instanceof CloudRevisionConflict))throw error;}
      }
     }
     if(pullEdits&&baseline&&canDownloadEdit(device,row.value,baseline)){
      const latestRemote=await revisionApi.read(row.itemId);
      if(!active||generation.current!==token)break;
      if(latestRemote&&latestRemote.revision===row.revision&&sameItem(latestRemote.value,row.value)){
       try{
        if(!active||generation.current!==token)break;
        await replaceCallback.current(structuredClone(row.value),structuredClone(device));
        await saveSyncBaseline(household,row.itemId,{revision:row.revision,value:structuredClone(row.value)});
        downloadedEdits++;continue;
       }catch{ /* Device changed concurrently; preserve both copies for review. */ }
      }
     }
     differences.push(device.name);
    }
    if(active&&generation.current===token)setDivergent(differences);
    // A known revision with no local item may indicate deletion. Do not resurrect it.
    const eligible:typeof remote=[];
    const reviewBaselines=new Map<string,SyncBaseline>();
    const missing:string[]=[];
    for(const row of remote){
     if(!active||generation.current!==token)break;
     if(ids.has(row.itemId))continue;
     const baseline=await readSyncBaseline(household,row.itemId);
     if(!active||generation.current!==token)break;
     if(baseline){reviewBaselines.set(row.itemId,baseline);missing.push(row.value.name);continue;}
     if(!row.value.photo&&!row.value.photos?.length&&!row.value.documents?.length)eligible.push(row);
    }
    if(active&&generation.current===token){
     setMissingLocally(missing);
     setDeletionReview(buildDeletionReview(local,remote,reviewBaselines).filter(row=>row.decision.kind!=="untracked").map(row=>({itemId:row.itemId,name:row.name,kind:row.decision.kind==="eligible"?"Candidate — review required":"Blocked — "+(row.decision.kind==="conflict"?row.decision.reason:"not eligible")})));
    }
    let imported=0;
    for(const row of eligible){
     if(!active||generation.current!==token)break;
     const latest=await loadInventory();
     if(!active||generation.current!==token)break;
     if(latest.some(i=>i.id===row.itemId)||await readSyncBaseline(household,row.itemId))continue;
     const refreshed=await createCloudRevisionApi<Item>(client,household).read(row.itemId);
     if(!active||generation.current!==token)break;
     if(!refreshed||refreshed.revision!==row.revision||JSON.stringify(refreshed.value)!==JSON.stringify(row.value))continue;
     if(!active||generation.current!==token)break;
     await importCallback.current(structuredClone(row.value));
     // The imported revision becomes the trusted starting point for future local edits.
     await saveSyncBaseline(household,row.itemId,{revision:row.revision,value:structuredClone(row.value)});
     imported++;
    }
    let uploaded=0;
    if(uploadEnabled&&active&&generation.current===token){
     const cloudIds=new Set(remote.map(r=>r.itemId));
     const api=createCloudRevisionApi<Item>(client,household);
     for(const item of local.filter(i=>!i.id.startsWith("demo-")&&!i.id.startsWith("__housevault_test_")&&!cloudIds.has(i.id)&&!i.photo&&!i.photos?.length&&!i.documents?.length)){
      if(!active||generation.current!==token)break;
      const latest=(await loadInventory()).find(i=>i.id===item.id);
      if(!active||generation.current!==token)break;
      if(!latest||JSON.stringify(latest)!==JSON.stringify(item))continue;
      if(await api.read(item.id))continue;
      if(!active||generation.current!==token)break;
      if(!active||generation.current!==token)break;
      try{const revision=await uploadNewCloudItem(item,api.write);await saveSyncBaseline(household,item.id,{revision,value:structuredClone(item)});uploaded++;}
      catch(error){if(error instanceof CloudRevisionConflict)continue;throw error;}
     }
    }
    if(active&&generation.current===token)setStatus("Cloud check complete: "+imported+" imported, "+uploaded+" newly uploaded, "+edited+" edits uploaded, "+downloadedEdits+" edits downloaded. Conflicting records preserved.");
   }catch{
    if(active&&generation.current===token)setStatus("Cloud check failed. No existing records were replaced; will retry while enabled.");
   }finally{inFlight.current=false;if(active&&generation.current===token)setBusy(false);}
  }
  void tick();
  const interval=window.setInterval(()=>void tick(),60000);
  const online=()=>void tick();
  const focus=()=>void tick();
  const visible=()=>{if(document.visibilityState==="visible")void tick();};
  window.addEventListener("online",online);
  window.addEventListener("focus",focus);
  document.addEventListener("visibilitychange",visible);
  return()=>{active=false;generation.current++;window.clearInterval(interval);window.removeEventListener("online",online);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visible);};
 },[client,household,enabled,uploadEnabled,editEnabled,pullEdits,householdKey,syncEpoch]);
 async function confirmDeletion(itemId:string,name:string){
  if(!enabled||!household||busy||deletionBusy)return;
  if(!window.confirm('Move cloud record "'+name+'" to recoverable deleted state? This affects other devices. This action cannot be undone from the app yet.'))return;
  const currentHousehold=household;
  const currentGeneration=generation.current;
  setDeletionBusy(true);
  try{
   const local=(await loadInventory()).find(i=>i.id===itemId)??null;
   const baseline=await readSyncBaseline(currentHousehold,itemId);
   const remote=await createCloudRevisionApi<Item>(client,currentHousehold).read(itemId);
   if(generation.current!==currentGeneration||!enabled||local)throw new Error("Device or household changed; refresh review");
   if(!baseline||!remote)throw new Error("Missing trusted cloud revision");
   const localAgain=(await loadInventory()).find(i=>i.id===itemId);
   if(localAgain)throw new Error("Record exists on this device");
   await submitConfirmedTombstone({client,confirmed:true,householdId:currentHousehold,itemId,local:null,baseline,remote});
   if(generation.current===currentGeneration){
    setDeletionReview(rows=>rows.filter(row=>row.itemId!==itemId));
    setMissingLocally(rows=>rows.filter(row=>row!==name));
    setStatus("Cloud record marked deleted. Its data is retained for recovery.");
   }
  }catch(error){
   if(generation.current===currentGeneration)setStatus(error instanceof Error?error.message:"Deletion failed; refresh review");
  }finally{setDeletionBusy(false);}
 }
 return <section className="account-card"><h3>Automatic inventory synchronization (beta)</h3><p className="account-helper">Opt in to check for new cloud records every minute while this app is open. Only attachment-free records missing on this device are imported. Existing records are never overwritten. Optional create-only uploads are available. Opt-in edit uploads and downloads require verified revision baselines and leave conflicting records untouched. Deletions are manual and require confirmation; attachments are not synchronized, and this does not run when the app is closed.</p><label htmlFor="auto-pull-household">Household</label><select id="auto-pull-household" disabled={enabled||busy} value={household} onChange={e=>{generation.current++;setSyncEpoch(v=>v+1);setHousehold(e.target.value);setStatus("Disabled — no automatic changes.");setDivergent([]);}}><option value="">Select household</option>{households.filter(h=>h.name!=="HouseVault Sync Test").map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><label><input type="checkbox" checked={enabled} disabled={!household} onChange={e=>{setEnabled(e.target.checked);if(!e.target.checked){generation.current++;setSyncEpoch(v=>v+1);setUploadEnabled(false);setEditEnabled(false);setPullEdits(false);setDivergent([]);setMissingLocally([]);setStatus("Disabled — no automatic changes.");}}}/> Enable automatic imports while app is open</label><label><input type="checkbox" checked={uploadEnabled} disabled={!enabled||busy} onChange={e=>{if(e.target.checked&&!window.confirm("Automatically create cloud copies of local-only attachment-free records while this app is open?"))return;setUploadEnabled(e.target.checked);}}/> Also upload new local-only records</label><label><input type="checkbox" checked={editEnabled} disabled={!enabled||busy} onChange={e=>{if(e.target.checked&&!window.confirm("Automatically upload edits to cloud records with a verified revision baseline? Conflicts remain untouched."))return;setEditEnabled(e.target.checked);}}/> Also synchronize safe existing-item edits</label><label><input type="checkbox" checked={pullEdits} disabled={!enabled||busy} onChange={e=>{if(e.target.checked&&!window.confirm("Automatically apply cloud edits only when this device still matches its last synced version? Local changes will be preserved."))return;setPullEdits(e.target.checked);}}/> Also download safe existing-item edits</label><p role="status">{busy?"Checking cloud…":status}</p>{deletionReview.length>0&&<div className="account-card"><strong>Deletion review (manual confirmation required)</strong><p>Missing local records are never deleted automatically. Manual deletion rechecks local state and cloud revision, requires confirmation, and retains the cloud payload for recovery. Use the recovery section below to restore retained records.</p><ul>{deletionReview.slice(0,12).map((row,index)=><li key={index}>{row.name}: {row.kind} {row.kind.startsWith("Candidate")&&<button type="button" disabled={busy||deletionBusy||!enabled} onClick={()=>void confirmDeletion(row.itemId,row.name)}>Review and delete cloud copy</button>}</li>)}</ul></div>}{missingLocally.length>0&&<div role="alert"><strong>{missingLocally.length} previously synced records are missing on this device.</strong><p>They will not be re-imported automatically. Deletion synchronization is not yet supported; review before restoring them.</p><p>{missingLocally.slice(0,8).join(", ")}{missingLocally.length>8?"…":""}</p></div>}{divergent.length>0&&<div role="alert"><strong>{divergent.length} differing cloud/device records need review.</strong><p>Automatic transfer will not overwrite these records. Open Cloud transfer and compare to inspect them.</p><p>{divergent.slice(0,8).join(", ")}{divergent.length>8?"…":""}</p></div>}<CloudRecovery client={client} household={household}/></section>;
}
