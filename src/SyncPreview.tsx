import { useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { loadInventory } from "./indexedStorage";
import { decideInitialSync } from "./syncFoundation";
import { type Item } from "./domain";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
type Household={id:string;name:string;created_by:string};
type Preview={localCount:number;remoteCount:number;decision:string;localOnly:number;remoteOnly:number;changed:number;attachments:number;household:string};
function attachmentCount(items:Item[]):number{
 return items.reduce((count,item)=>count+(item.photo?1:0)+(item.photos?.length??0)+(item.documents?.length??0),0);
}

const BUCKET="housevault-attachments";
function dataToBlob(data:string):Blob{
 const match=/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(data);
 if(!match)throw new Error("Unsupported attachment data. Only JPEG, PNG, WebP and PDF files can be uploaded.");
 const bytes=atob(match[2]);if(bytes.length>10_485_760)throw new Error("An attachment exceeds the 10 MB limit.");
 const out=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)out[i]=bytes.charCodeAt(i);
 return new Blob([out],{type:match[1]});
}
async function prepareCloudItem(item:Item,household:string):Promise<Item>{
 if(!client)throw new Error("Cloud connection unavailable.");
 const copy:Item={...item};const uploaded=new Map<string,string>();
 async function store(data:string):Promise<string>{
  if(data.startsWith("cloud-asset:"))return data;
  if(!data.startsWith("data:"))throw new Error("An attachment is not available on this device.");
  if(uploaded.has(data))return uploaded.get(data)!;
  const blob=dataToBlob(data);
  const path=household+"/"+crypto.randomUUID();
  const {error}=await client!.storage.from(BUCKET).upload(path,blob,{contentType:blob.type,upsert:false});
  if(error)throw new Error("Could not securely upload an attachment. No inventory records were deleted.");
  const reference="cloud-asset:"+path;uploaded.set(data,reference);return reference;
 }
 if(copy.photo)copy.photo=await store(copy.photo);
 if(copy.photos)copy.photos=await Promise.all(copy.photos.map(store));
 if(copy.documents)copy.documents=await Promise.all(copy.documents.map(async d=>({...d,data:await store(d.data)})));
 return copy;
}

export default function SyncPreview({session,households}:{session:Session;households:Household[]}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [uploadMessage,setUploadMessage]=useState("");
 async function compare(){
  if(!client||!household||busy||!households.some(h=>h.id===household))return;
  setBusy(true);setError("");setUploadMessage("");setPreview(null);
  try{
   const local=await loadInventory();
   const {data,error:remoteError}=await client.from("inventory_records").select("item_id,payload,deleted_at").eq("household_id",household).limit(1001);
   if(remoteError)throw new Error("Could not read household inventory. Please check your connection and permissions.");
   if(!data||data.length>1000)throw new Error("The cloud inventory exceeds the 1,000-record preview limit.");
   const remote=data.filter(row=>!row.deleted_at).map(row=>row.payload as Item);
   const cleanRemote=remote;
   const decision=decideInitialSync(local.map(item=>({...item,photo:undefined,photos:undefined,documents:undefined})),cleanRemote.map(item=>({...item,photo:undefined,photos:undefined,documents:undefined})));
   setPreview({localCount:local.length,remoteCount:cleanRemote.length,decision:decision.kind,localOnly:"localOnly" in decision?decision.localOnly:0,remoteOnly:"remoteOnly" in decision?decision.remoteOnly:0,changed:"changed" in decision?decision.changed:0,attachments:attachmentCount(local),household});
  }catch(e){setError(e instanceof Error?e.message:"Could not compare inventory.");}
  finally{setBusy(false);}
 }

 async function uploadFirstCopy(){
  if(!client||!household||busy||!preview||preview.household!==household||preview.decision!=="upload-local")return;
  if(!window.confirm("Upload this device's inventory to the selected household? This creates cloud copies; it does not remove or replace local records. Back up your inventory first. Do not edit items on another device during this first upload."))return;
  setBusy(true);setError("");setUploadMessage("");
  try{
   const local=await loadInventory();
   if(!local.length||local.length>1000)throw new Error("Only 1–1,000 records can be uploaded at once.");
   if(local.some(item=>JSON.stringify(item).includes("hv-asset:")))throw new Error("Some attachments are unavailable in local storage. Export a backup and inspect these items before uploading.");
   const {data:membership,error:membershipError}=await client.from("household_members").select("role").eq("household_id",household).eq("user_id",session.user.id).single();
   if(membershipError||!["owner","editor"].includes(membership?.role??""))throw new Error("Only household owners or editors can upload inventory.");
   const {data:existing,error:readError}=await client.from("inventory_records").select("item_id").eq("household_id",household).limit(1);
   if(readError||!existing||existing.length)throw new Error("Cloud inventory is no longer empty. Compare again before uploading.");
   let completed=0;
   for(const item of local){
    const {error:writeError}=await client.rpc("put_inventory_record",{target_household:household,target_item:item.id,target_payload:await prepareCloudItem(item,household),expected_revision:0});
    if(writeError)throw new Error("Upload stopped after "+completed+" records. Some records and private attachment files may already be in the cloud. Compare inventories before retrying; no local records were changed.");
    completed++;
   }
   setUploadMessage("Uploaded "+completed+" records to your household. Your device inventory is unchanged. Automatic two-way sync is not yet enabled.");
   setPreview(null);
  }catch(e){setError(e instanceof Error?e.message:"Upload failed. Compare again.");setPreview(null);}
  finally{setBusy(false);}
 }
 return <div className="account-card account-wide">
  <div className="account-section-heading"><div><span className="account-kicker">SYNC SETUP · CONTROLLED FIRST UPLOAD</span><h3>Compare device and cloud inventory</h3><p>Review the two inventories before enabling synchronization. Comparison is read-only. First-time upload is available only after confirmation when the cloud is empty and the cloud is empty. Photos and documents upload to private household storage first.</p></div></div>
  <div className="account-inline-form"><div><label htmlFor="sync-household">Household</label><select id="sync-household" value={household} onChange={e=>{setHousehold(e.target.value);setPreview(null);setError("");}}><option value="">Select a household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></div><button type="button" disabled={!household||busy||!session.user.id} onClick={()=>void compare()}>{busy?"Comparing…":"Compare inventories"}</button></div>
  {error&&<p role="alert" className="account-feedback">{error}</p>}
  {uploadMessage&&<p role="status" className="account-feedback">{uploadMessage}</p>}
  {preview&&preview.household===household&&<div className="account-sync-preview" role="status"><p><strong>On this device:</strong> {preview.localCount} records</p><p><strong>In the cloud:</strong> {preview.remoteCount} records</p>
   <p><strong>Assessment:</strong> {preview.decision==="upload-local"?"Local inventory exists; cloud inventory is empty.":preview.decision==="download-remote"?"Cloud inventory exists; device inventory is empty.":preview.decision==="identical"?"The records match.":preview.decision==="empty"?"Both inventories are empty.":"Differences need review before any transfer."}</p>
   {preview.decision==="review-required"&&<p>Device-only: {preview.localOnly} · Cloud-only: {preview.remoteOnly} · Changed: {preview.changed}</p>}
   {preview.attachments>0&&<p><strong>Attachment warning:</strong> {preview.attachments} local photo/document references will be uploaded to private household storage. Download and automatic synchronization are not enabled yet.</p>}
   <p><strong>No transfer has occurred from comparison.</strong> Export a JSON backup before any upload. Automatic two-way sync and downloading are not yet enabled.</p>
   {preview.decision==="upload-local"&&<button type="button" className="secondary" disabled={busy} onClick={()=>void uploadFirstCopy()}>{busy?"Uploading…":"Upload first cloud copy (confirmation required)"}</button>}</div>}
 </div>;
}
