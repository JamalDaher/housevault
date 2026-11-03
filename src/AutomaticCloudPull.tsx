import {useEffect,useRef,useState} from "react";
import {loadInventory} from "./indexedStorage";
import {fetchCloudInventory} from "./cloudInventoryTransfer";
import type {Item} from "./domain";

type Client=Parameters<typeof fetchCloudInventory>[0];
type Household={id:string;name:string};
export default function AutomaticCloudPull({client,households,onImportCloudItem}:{client:Client;households:Household[];onImportCloudItem:(item:Item)=>Promise<void>}){
 const [household,setHousehold]=useState("");
 const [enabled,setEnabled]=useState(false);
 const [status,setStatus]=useState("Disabled — no automatic changes.");
 const [busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 const importCallback=useRef(onImportCloudItem);
 importCallback.current=onImportCloudItem;
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setEnabled(false);setStatus("Disabled — no automatic changes.");},[client]);
 useEffect(()=>{
  if(!enabled||!households.some(h=>h.id===household))return;
  let active=true;
  const token=++generation.current;
  async function tick(){
   if(inFlight.current||!active||navigator.onLine===false)return;
   inFlight.current=true;setBusy(true);
   try{
    const remote=await fetchCloudInventory(client,household);
    if(!active||generation.current!==token)return;
    const local=await loadInventory();
    const ids=new Set(local.map(i=>i.id));
    const eligible=remote.filter(r=>!ids.has(r.itemId)&&!r.value.photo&&!r.value.photos?.length&&!r.value.documents?.length);
    let imported=0;
    for(const row of eligible){
     if(!active||generation.current!==token)break;
     const latest=await loadInventory();
     if(latest.some(i=>i.id===row.itemId))continue;
     await importCallback.current(structuredClone(row.value));
     imported++;
    }
    if(active&&generation.current===token)setStatus(imported?"Imported "+imported+" new cloud records. Existing records preserved.":"Checked cloud: no new attachment-free records.");
   }catch{
    if(active&&generation.current===token)setStatus("Cloud check failed. No existing records were replaced; will retry while enabled.");
   }finally{inFlight.current=false;if(active&&generation.current===token)setBusy(false);}
  }
  void tick();
  const interval=window.setInterval(()=>void tick(),60000);
  const online=()=>void tick();
  window.addEventListener("online",online);
  return()=>{active=false;generation.current++;window.clearInterval(interval);window.removeEventListener("online",online);};
 },[client,household,enabled,households]);
 return <section className="account-card"><h3>Automatic cloud-only imports (beta)</h3><p className="account-helper">Opt in to check for new cloud records every minute while this app is open. Only attachment-free records missing on this device are imported. Existing records are never overwritten. This does not upload edits, synchronize deletions, or run when the app is closed.</p><label htmlFor="auto-pull-household">Household</label><select id="auto-pull-household" disabled={enabled||busy} value={household} onChange={e=>{setHousehold(e.target.value);setStatus("Disabled — no automatic changes.");}}><option value="">Select household</option>{households.filter(h=>h.name!=="HouseVault Sync Test").map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><label><input type="checkbox" checked={enabled} disabled={!household} onChange={e=>setEnabled(e.target.checked)}/> Enable automatic imports while app is open</label><p role="status">{busy?"Checking cloud…":status}</p></section>;
}
