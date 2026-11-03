import {useEffect,useRef,useState} from "react";
import {loadInventory} from "./indexedStorage";
import {fetchCloudInventory,uploadNewCloudItem} from "./cloudInventoryTransfer";
import {createCloudRevisionApi} from "./cloudRevisionApi";
import {CloudRevisionConflict} from "./syncRevision";
import type {Item} from "./domain";

type Client=Parameters<typeof fetchCloudInventory>[0]&Parameters<typeof createCloudRevisionApi<Item>>[0];
type Household={id:string;name:string};
export default function AutomaticCloudPull({client,households,onImportCloudItem}:{client:Client;households:Household[];onImportCloudItem:(item:Item)=>Promise<void>}){
 const [household,setHousehold]=useState("");
 const [enabled,setEnabled]=useState(false);
 const [status,setStatus]=useState("Disabled — no automatic changes.");
 const [busy,setBusy]=useState(false);
 const [uploadEnabled,setUploadEnabled]=useState(false);
 const [divergent,setDivergent]=useState<string[]>([]);
 const inFlight=useRef(false);
 const householdKey=households.map(h=>h.id).join("|");
 const importCallback=useRef(onImportCloudItem);
 importCallback.current=onImportCloudItem;
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setEnabled(false);setUploadEnabled(false);setDivergent([]);setStatus("Disabled — no automatic changes.");},[client]);
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
    const differences=remote.filter(r=>{const device=localById.get(r.itemId);return device&&JSON.stringify(device)!==JSON.stringify(r.value);}).map(r=>r.value.name);
    if(active&&generation.current===token)setDivergent(differences);
    const eligible=remote.filter(r=>!ids.has(r.itemId)&&!r.value.photo&&!r.value.photos?.length&&!r.value.documents?.length);
    let imported=0;
    for(const row of eligible){
     if(!active||generation.current!==token)break;
     const latest=await loadInventory();
     if(!active||generation.current!==token)break;
     if(latest.some(i=>i.id===row.itemId))continue;
     const refreshed=await createCloudRevisionApi<Item>(client,household).read(row.itemId);
     if(!active||generation.current!==token)break;
     if(!refreshed||refreshed.revision!==row.revision||JSON.stringify(refreshed.value)!==JSON.stringify(row.value))continue;
     await importCallback.current(structuredClone(row.value));
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
      try{await uploadNewCloudItem(item,api.write);uploaded++;}
      catch(error){if(error instanceof CloudRevisionConflict)continue;throw error;}
     }
    }
    if(active&&generation.current===token)setStatus("Cloud check complete: "+imported+" imported, "+uploaded+" newly uploaded. Existing records preserved.");
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
 },[client,household,enabled,uploadEnabled,householdKey]);
 return <section className="account-card"><h3>Automatic new-record transfers (beta)</h3><p className="account-helper">Opt in to check for new cloud records every minute while this app is open. Only attachment-free records missing on this device are imported. Existing records are never overwritten. Optional create-only uploads are available. Edits, deletions, and attachments are not synchronized, and this does not run when the app is closed.</p><label htmlFor="auto-pull-household">Household</label><select id="auto-pull-household" disabled={enabled||busy} value={household} onChange={e=>{setHousehold(e.target.value);setStatus("Disabled — no automatic changes.");setDivergent([]);}}><option value="">Select household</option>{households.filter(h=>h.name!=="HouseVault Sync Test").map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><label><input type="checkbox" checked={enabled} disabled={!household} onChange={e=>{setEnabled(e.target.checked);if(!e.target.checked){setUploadEnabled(false);setDivergent([]);setStatus("Disabled — no automatic changes.");}}}/> Enable automatic imports while app is open</label><label><input type="checkbox" checked={uploadEnabled} disabled={!enabled||busy} onChange={e=>{if(e.target.checked&&!window.confirm("Automatically create cloud copies of local-only attachment-free records while this app is open?"))return;setUploadEnabled(e.target.checked);}}/> Also upload new local-only records</label><p role="status">{busy?"Checking cloud…":status}</p>{divergent.length>0&&<div role="alert"><strong>{divergent.length} differing cloud/device records need review.</strong><p>Automatic transfer will not overwrite these records. Open Cloud transfer and compare to inspect them.</p><p>{divergent.slice(0,8).join(", ")}{divergent.length>8?"…":""}</p></div>}</section>;
}
