import { useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { loadInventory } from "./indexedStorage";
import { decideInitialSync } from "./syncFoundation";
import { parseBackup, exportBackup, type Item } from "./domain";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
type Household={id:string;name:string;created_by:string};
type Preview={localCount:number;remoteCount:number;decision:string;localOnly:number;remoteOnly:number;changed:number;attachments:number;household:string};
function attachmentCount(items:Item[]):number{
 return items.reduce((count,item)=>count+(item.photo?1:0)+(item.photos?.length??0)+(item.documents?.length??0),0);
}
export default function SyncPreview({session,households}:{session:Session;households:Household[]}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 async function compare(){
  if(!client||!household||busy||!households.some(h=>h.id===household))return;
  setBusy(true);setError("");setPreview(null);
  try{
   const local=await loadInventory();
   const {data,error:remoteError}=await client.from("inventory_records").select("item_id,payload,deleted_at").eq("household_id",household).limit(1001);
   if(remoteError)throw new Error("Could not read household inventory. Please check your connection and permissions.");
   if(!data||data.length>1000)throw new Error("The cloud inventory exceeds the 1,000-record preview limit.");
   const remote=data.filter(row=>!row.deleted_at).map(row=>row.payload as Item);
   const cleanRemote=parseBackup(exportBackup(remote));
   const decision=decideInitialSync(local,cleanRemote);
   setPreview({localCount:local.length,remoteCount:cleanRemote.length,decision:decision.kind,localOnly:"localOnly" in decision?decision.localOnly:0,remoteOnly:"remoteOnly" in decision?decision.remoteOnly:0,changed:"changed" in decision?decision.changed:0,attachments:attachmentCount(local),household});
  }catch(e){setError(e instanceof Error?e.message:"Could not compare inventory.");}
  finally{setBusy(false);}
 }
 return <div className="account-card account-wide">
  <div className="account-section-heading"><div><span className="account-kicker">SYNC SETUP · PREVIEW ONLY</span><h3>Compare device and cloud inventory</h3><p>Review the two inventories before enabling synchronization. This check does not upload, download, or change any records.</p></div></div>
  <div className="account-inline-form"><div><label htmlFor="sync-household">Household</label><select id="sync-household" value={household} onChange={e=>{setHousehold(e.target.value);setPreview(null);setError("");}}><option value="">Select a household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></div><button type="button" disabled={!household||busy||!session.user.id} onClick={()=>void compare()}>{busy?"Comparing…":"Compare inventories"}</button></div>
  {error&&<p role="alert" className="account-feedback">{error}</p>}
  {preview&&preview.household===household&&<div className="account-sync-preview" role="status"><p><strong>On this device:</strong> {preview.localCount} records</p><p><strong>In the cloud:</strong> {preview.remoteCount} records</p>
   <p><strong>Assessment:</strong> {preview.decision==="upload-local"?"Local inventory exists; cloud inventory is empty.":preview.decision==="download-remote"?"Cloud inventory exists; device inventory is empty.":preview.decision==="identical"?"The records match.":preview.decision==="empty"?"Both inventories are empty.":"Differences need review before any transfer."}</p>
   {preview.decision==="review-required"&&<p>Device-only: {preview.localOnly} · Cloud-only: {preview.remoteOnly} · Changed: {preview.changed}</p>}
   {preview.attachments>0&&<p><strong>Attachment warning:</strong> {preview.attachments} local photo/document references require private attachment storage before full synchronization.</p>}
   <p><strong>No transfer has occurred.</strong> First-time upload/download and ongoing sync are not enabled yet. Export a JSON backup before any future transfer.</p></div>}
 </div>;
}
