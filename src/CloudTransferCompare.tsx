import {useState} from "react";
import {loadInventory} from "./indexedStorage";
import {fetchCloudInventory} from "./cloudInventoryTransfer";
import type {Item} from "./domain";
type Client=Parameters<typeof fetchCloudInventory>[0];
export default function CloudTransferCompare({client,households}:{client:Client;households:{id:string;name:string}[]}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [candidates,setCandidates]=useState<Item[]>([]);
 async function compare(){
  if(busy||!households.some(h=>h.id===household))return;
  setBusy(true);setMessage("");setCandidates([]);
  try{
   const [local,remote]=await Promise.all([loadInventory(),fetchCloudInventory(client,household)]);
   const remoteIds=new Set(remote.map(r=>r.itemId));
   const ready=local.filter(i=>!i.id.startsWith("demo-")&&!remoteIds.has(i.id)&&!i.photo&&!i.photos?.length&&!i.documents?.length);
   setCandidates(ready);
   setMessage(ready.length+" attachment-free local records eligible for cloud upload. "+remote.length+" cloud revisions found. No inventory was changed.");
  }catch{setMessage("Could not compare device and cloud records. Nothing was changed.");}
  finally{setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud transfer readiness</h3><p>Compare actual device and cloud records before enabling uploads or automatic synchronization.</p><label htmlFor="transfer-household">Household</label><select id="transfer-household" value={household} onChange={e=>{setHousehold(e.target.value);setCandidates([]);setMessage("");}}><option value="">Select household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={busy||!household} onClick={()=>void compare()}>{busy?"Comparing…":"Compare device and cloud"}</button>{message&&<p role="status">{message}</p>}{candidates.length>0&&<p>Ready to transfer: {candidates.slice(0,10).map(i=>i.name).join(", ")}</p>}</section>;
}
