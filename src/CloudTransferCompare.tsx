import {useRef,useState} from "react";
import {loadInventory} from "./indexedStorage";
import {fetchCloudInventory,uploadNewCloudItem} from "./cloudInventoryTransfer";
import {createCloudRevisionApi} from "./cloudRevisionApi";
import {CloudRevisionConflict} from "./syncRevision";
import type {Item} from "./domain";
type Client=Parameters<typeof fetchCloudInventory>[0]&Parameters<typeof createCloudRevisionApi<Item>>[0];
export default function CloudTransferCompare({client,households,onImportCloudItem}:{client:Client;households:{id:string;name:string}[];onImportCloudItem:(item:Item)=>Promise<void>}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [candidates,setCandidates]=useState<Item[]>([]);
 const [downloads,setDownloads]=useState<Item[]>([]);
 const request=useRef(0);
 async function compare(){
  if(busy||!households.some(h=>h.id===household))return;
  const token=++request.current;
  setBusy(true);setMessage("");setCandidates([]);setDownloads([]);
  try{
   const [local,remote]=await Promise.all([loadInventory(),fetchCloudInventory(client,household)]);
   if(token!==request.current)return;
   const remoteIds=new Set(remote.map(r=>r.itemId));
   const ready=local.filter(i=>!i.id.startsWith("demo-")&&!i.id.startsWith("__housevault_test_")&&!remoteIds.has(i.id)&&!i.photo&&!i.photos?.length&&!i.documents?.length);
   setCandidates(ready);
   const localIds=new Set(local.map(i=>i.id));
   setDownloads(remote.filter(r=>!localIds.has(r.itemId)&&!r.value.photo&&!r.value.photos?.length&&!r.value.documents?.length).map(r=>r.value));
   setMessage(ready.length+" attachment-free local records eligible for create-only upload. "+remote.length+" cloud revisions found. No inventory was changed.");
  }catch{if(token===request.current)setMessage("Could not compare device and cloud records. Nothing was changed.");}
  finally{if(token===request.current)setBusy(false);}
 }
 async function upload(item:Item){
  if(busy||!households.some(h=>h.id===household)||!candidates.some(i=>i.id===item.id))return;
  if(!window.confirm("Create a cloud copy of "+item.name+"? Existing cloud records will not be overwritten."))return;
  const token=++request.current;
  setBusy(true);setCandidates([]);setDownloads([]);setMessage("");
  try{
   const current=(await loadInventory()).find(i=>i.id===item.id);
   if(!current||JSON.stringify(current)!==JSON.stringify(item))throw new Error("Local record changed");
   const api=createCloudRevisionApi<Item>(client,household);
   if(await api.read(item.id))throw new CloudRevisionConflict<Item>(null,null);
   await uploadNewCloudItem(item,api.write);
   if(token===request.current)setMessage("Cloud copy created. Device inventory unchanged. Compare again before further uploads.");
  }catch(error){
   if(token===request.current)setMessage(error instanceof CloudRevisionConflict?"Cloud record already exists or changed. Nothing was overwritten.":"Upload failed or local record changed. Device inventory unchanged.");
  }finally{if(token===request.current)setBusy(false);}
 }
 async function download(item:Item){
  if(busy||!downloads.some(i=>i.id===item.id)||!households.some(h=>h.id===household))return;
  if(!window.confirm("Import "+item.name+" from cloud to this device? Existing local items will not be replaced."))return;
  const token=++request.current;setBusy(true);setDownloads([]);setCandidates([]);setMessage("");
  try{
   const remote=await createCloudRevisionApi<Item>(client,household).read(item.id);
   if(!remote||JSON.stringify(remote.value)!==JSON.stringify(item))throw new Error("Cloud changed");
   if((await loadInventory()).some(i=>i.id===item.id))throw new Error("Local record already exists");
   await onImportCloudItem(structuredClone(item));
   if(token===request.current)setMessage("Imported one cloud record. Existing local records were preserved.");
  }catch{if(token===request.current)setMessage("Import failed or records changed. Compare again.");}
  finally{if(token===request.current)setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud transfer</h3><p>Compare device and cloud inventory. You may explicitly upload one new attachment-free record at a time. Existing cloud records are never overwritten; automatic sync is not yet enabled. Importing a cloud-only record requires confirmation.</p><label htmlFor="transfer-household">Household</label><select id="transfer-household" disabled={busy} value={household} onChange={e=>{request.current++;setHousehold(e.target.value);setCandidates([]);setDownloads([]);setMessage("");}}><option value="">Select household</option>{households.filter(h=>h.name!=="HouseVault Sync Test").map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={busy||!household} onClick={()=>void compare()}>{busy?"Working…":"Compare device and cloud"}</button>{message&&<p role="status">{message}</p>}{candidates.length>0&&<ul className="account-household-list">{candidates.slice(0,30).map(i=><li key={i.id}><span>{i.name}</span><button type="button" disabled={busy} onClick={()=>void upload(i)}>Upload new</button></li>)}</ul>}{candidates.length>30&&<p>Showing the first 30 upload candidates.</p>}{downloads.length>0&&<><h4>Cloud-only records</h4><ul className="account-household-list">{downloads.slice(0,30).map(i=><li key={i.id}><span>{i.name}</span><button type="button" disabled={busy} onClick={()=>void download(i)}>Import to device</button></li>)}</ul></>}{downloads.length>30&&<p>Showing the first 30 import candidates.</p>}</section>;
}
