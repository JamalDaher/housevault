import { useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { loadInventory } from "./indexedStorage";
import { compareEquipmentMetadata, cloudAttachmentPaths, countAttachmentReferences, previewRecordConflicts, type RecordConflict, type ConflictChoice, validateConflictApprovals } from "./syncFoundation";
import { exportBackup, parseBackup, type Item } from "./domain";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
type Household={id:string;name:string;created_by:string};
type Preview={localCount:number;remoteCount:number;decision:string;localOnly:number;remoteOnly:number;changed:number;attachments:number;cloudAttachments:number;verifiedFiles:number;missingFiles:number;invalidReferences:number;conflicts:RecordConflict[];household:string};
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

export default function SyncPreview({session,households,onImportCloudItem}:{session:Session;households:Household[];onImportCloudItem:(item:Item)=>Promise<void>}){
 const [household,setHousehold]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [uploadMessage,setUploadMessage]=useState("");
 const [choices,setChoices]=useState<Record<string,ConflictChoice>>({});
 async function compare(){
  if(!client||!household||busy||!households.some(h=>h.id===household))return;
  setBusy(true);setError("");setUploadMessage("");setPreview(null);setChoices({});
  try{
   const local=await loadInventory();
   const {data,error:remoteError}=await client.from("inventory_records").select("item_id,payload,deleted_at").eq("household_id",household).limit(1001);
   if(remoteError)throw new Error("Could not read household inventory. Please check your connection and permissions.");
   if(!data||data.length>1000)throw new Error("The cloud inventory exceeds the 1,000-record preview limit.");
   const remote=data.filter(row=>!row.deleted_at).map(row=>row.payload as Item);
   const cleanRemote=remote;
   const decision=compareEquipmentMetadata(local,cleanRemote);
   const conflicts=previewRecordConflicts(local,cleanRemote);
   const references=cloudAttachmentPaths(cleanRemote,household);
   let verifiedFiles=0,missingFiles=0;
   for(const path of references.paths){
    const {error:headError}=await client.storage.from(BUCKET).info(path);
    if(headError)missingFiles++;else verifiedFiles++;
   }
   setPreview({localCount:local.length,remoteCount:cleanRemote.length,decision:decision.kind,localOnly:"localOnly" in decision?decision.localOnly:0,remoteOnly:"remoteOnly" in decision?decision.remoteOnly:0,changed:"changed" in decision?decision.changed:0,attachments:attachmentCount(local),cloudAttachments:countAttachmentReferences(cleanRemote),verifiedFiles,missingFiles,invalidReferences:references.invalid,conflicts,household});
  }catch(e){setError(e instanceof Error?e.message:"Could not compare inventory.");}
  finally{setBusy(false);}
 }


 async function downloadCloudBackup(){
  if(!client||!household||busy||!preview||preview.household!==household||preview.missingFiles||preview.invalidReferences||!preview.remoteCount)return;
  if(!window.confirm("Download a complete cloud inventory JSON backup? This does not change your device inventory. Keep the file private."))return;
  setBusy(true);setError("");setUploadMessage("");
  try{
   const {data,error:readError}=await client.from("inventory_records").select("payload,deleted_at").eq("household_id",household).limit(1001);
   if(readError||!data||data.length>1000)throw new Error("Could not safely read all cloud records.");
   const remote=data.filter(row=>!row.deleted_at).map(row=>row.payload as Item);
   if(remote.length!==preview.remoteCount)throw new Error("Cloud inventory changed since comparison. Compare again.");
   const references=cloudAttachmentPaths(remote,household);
   if(references.invalid)throw new Error("Invalid cloud attachment references. Download blocked.");
   const resolved=new Map<string,string>();
   for(const path of references.paths){
    const {data:file,error:fileError}=await client.storage.from(BUCKET).download(path);
    if(fileError||!file)throw new Error("A private attachment could not be downloaded. No local records were changed.");
    if(file.size>10_485_760)throw new Error("A private attachment exceeds the 10 MB limit.");
    const type=file.type;
    if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(type))throw new Error("Unsupported cloud attachment format.");
    const encoded=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Attachment read failed"));reader.readAsDataURL(file);
    });
    resolved.set("cloud-asset:"+path,encoded);
   }
   const restored=remote.map(item=>({...item,
    photo:item.photo?resolved.get(item.photo)??item.photo:undefined,
    photos:item.photos?.map(p=>resolved.get(p)??p),
    documents:item.documents?.map(d=>({...d,data:resolved.get(d.data)??d.data}))
   }));
   const raw=exportBackup(restored);
   parseBackup(raw);
   const blob=new Blob([raw],{type:"application/json"});
   const href=URL.createObjectURL(blob);
   const anchor=document.createElement("a");anchor.href=href;anchor.download="housevault-cloud-backup-"+new Date().toISOString().slice(0,10)+".json";
   document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
   setUploadMessage("Cloud backup prepared for download. Your device inventory was not modified. Store the JSON file privately.");
  }catch(e){setError(e instanceof Error?e.message:"Could not download cloud backup.");}
  finally{setBusy(false);}
 }

 async function uploadApprovedNewRecord(id:string){
  if(!client||busy||!preview||preview.household!==household||choices[id]!=="keep-device"||!preview.conflicts.some(c=>c.id===id&&c.status==="device-only"))return;
  if(!window.confirm("Create a cloud copy of this device-only record? This will not change your device inventory or overwrite an existing cloud record. Keep a backup first."))return;
  setBusy(true);setError("");setUploadMessage("");
  try{
   const local=await loadInventory();
   const item=local.find(entry=>entry.id===id);
   if(!item)throw new Error("The device record changed. Compare again.");
   const {data:membership,error:memberError}=await client.from("household_members").select("role").eq("household_id",household).eq("user_id",session.user.id).single();
   if(memberError||!["owner","editor"].includes(membership?.role??""))throw new Error("Only owners and editors can upload records.");
   const {data:existing,error:readError}=await client.from("inventory_records").select("item_id").eq("household_id",household).eq("item_id",id).limit(1);
   if(readError||!existing)throw new Error("Unable to check cloud revision.");
   if(existing.length)throw new Error("This record now exists in the cloud. Compare again; nothing was overwritten.");
   const payload=await prepareCloudItem(item,household);
   const fresh=(await loadInventory()).find(entry=>entry.id===id);
   if(!fresh||JSON.stringify(fresh)!==JSON.stringify(item))throw new Error("Device record changed during upload preparation. No cloud record was written.");
   const {error:writeError}=await client.rpc("put_inventory_record",{target_household:household,target_item:id,target_payload:payload,expected_revision:0});
   if(writeError)throw new Error("Cloud rejected the record or its revision changed. No device records were changed; uploaded attachment files may need cleanup.");
   setUploadMessage("Created one new cloud record. Device inventory unchanged. Compare again to refresh differences.");
   setPreview(null);setChoices({});
  }catch(e){setError(e instanceof Error?e.message:"Unable to create cloud record.");setPreview(null);}
  finally{setBusy(false);}
 }

 async function uploadApprovedChangedRecord(id:string){
  if(!client||busy||!preview||preview.household!==household||choices[id]!=="keep-device"||!preview.conflicts.some(c=>c.id===id&&c.status==="different"))return;
  if(!window.confirm("Replace the cloud version of this ONE record with the device version? The previous cloud version will be replaced. Download a complete cloud backup first. Your device inventory will not change."))return;
  setBusy(true);setError("");setUploadMessage("");
  try{
   const item=(await loadInventory()).find(entry=>entry.id===id);
   if(!item)throw new Error("Device record missing. Compare again.");
   const {data:membership,error:memberError}=await client.from("household_members").select("role").eq("household_id",household).eq("user_id",session.user.id).single();
   if(memberError||!["owner","editor"].includes(membership?.role??""))throw new Error("Only owners or editors can update cloud records.");
   const {data:cloud,error:readError}=await client.from("inventory_records").select("payload,revision,deleted_at").eq("household_id",household).eq("item_id",id).single();
   if(readError||!cloud||cloud.deleted_at||!Number.isSafeInteger(cloud.revision)||cloud.revision<1)throw new Error("Cloud record or revision unavailable. Compare again.");
   if(cloud.payload?.id!==id)throw new Error("Cloud record identity mismatch.");
   const payload=await prepareCloudItem(item,household);
   const fresh=(await loadInventory()).find(entry=>entry.id===id);
   if(!fresh||JSON.stringify(fresh)!==JSON.stringify(item))throw new Error("Device record changed while preparing attachments. No cloud record was replaced.");
   const {error:writeError}=await client.rpc("put_inventory_record",{target_household:household,target_item:id,target_payload:payload,expected_revision:cloud.revision});
   if(writeError)throw new Error("Cloud rejected the update, possibly because the revision changed. Compare again. Any newly uploaded private files may require cleanup.");
   setUploadMessage("Updated one cloud record after revision check. Device inventory was not modified. Compare again.");
   setPreview(null);setChoices({});
  }catch(e){setError(e instanceof Error?e.message:"Cloud update failed. Compare again.");setPreview(null);}
  finally{setBusy(false);}
 }

 async function importCloudOnlyRecord(id:string){
  if(!client||busy||!preview||preview.household!==household||choices[id]!=="keep-cloud"||!preview.conflicts.some(c=>c.id===id&&c.status==="cloud-only"))return;
  if(!window.confirm("Import this cloud-only record and its attachments into your device inventory? Existing device records will not be replaced. Save a device backup first."))return;
  setBusy(true);setError("");setUploadMessage("");
  try{
   const local=await loadInventory();
   if(local.some(item=>item.id===id))throw new Error("This record already exists on the device. Compare again.");
   const {data,error:readError}=await client.from("inventory_records").select("payload,revision,deleted_at").eq("household_id",household).eq("item_id",id).single();
   if(readError||!data||data.deleted_at)throw new Error("Cloud record unavailable. Compare again.");
   const item=data.payload as Item;
   if(item.id!==id)throw new Error("Cloud record identity mismatch.");
   const refs=cloudAttachmentPaths([item],household);
   if(refs.invalid)throw new Error("Invalid cloud attachment references. Import blocked.");
   const resolved=new Map<string,string>();
   for(const path of refs.paths){
    const {data:file,error:fileError}=await client.storage.from(BUCKET).download(path);
    if(fileError||!file||file.size>10_485_760||!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type))throw new Error("A private attachment could not be safely restored.");
    const encoded=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Attachment read failed"));reader.readAsDataURL(file);
    });
    resolved.set("cloud-asset:"+path,encoded);
   }
   const restored={...item,photo:item.photo?resolved.get(item.photo)??item.photo:undefined,photos:item.photos?.map(p=>resolved.get(p)??p),documents:item.documents?.map(d=>({...d,data:resolved.get(d.data)??d.data}))};
   const validated=parseBackup(exportBackup([restored]))[0];
   const {data:latest,error:latestError}=await client.from("inventory_records").select("revision,deleted_at").eq("household_id",household).eq("item_id",id).single();
   if(latestError||!latest||latest.deleted_at||latest.revision!==data.revision)throw new Error("Cloud record changed while downloading. Compare again.");
   if((await loadInventory()).some(existing=>existing.id===id))throw new Error("Device record appeared during import. Compare again.");
   await onImportCloudItem(validated);
   setUploadMessage("Imported and saved one cloud-only record with its attachments in device storage. Existing device records were not replaced.");
   setPreview(null);setChoices({});
  }catch(e){setError(e instanceof Error?e.message:"Unable to import cloud record.");setPreview(null);}
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
  <div className="account-section-heading"><div><span className="account-kicker">SYNC SETUP · CONTROLLED FIRST UPLOAD</span><h3>Compare device and cloud inventory</h3><p>Review the two inventories before enabling synchronization. Comparison is read-only. First-time upload is available only after confirmation when the selected household cloud inventory is empty. Photos and documents upload to private household storage first.</p></div></div>
  <div className="account-inline-form"><div><label htmlFor="sync-household">Household</label><select id="sync-household" value={household} onChange={e=>{setHousehold(e.target.value);setPreview(null);setError("");}}><option value="">Select a household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></div><button type="button" disabled={!household||busy||!session.user.id} onClick={()=>void compare()}>{busy?"Comparing…":"Compare inventories"}</button></div>
  {error&&<p role="alert" className="account-feedback">{error}</p>}
  {uploadMessage&&<p role="status" className="account-feedback">{uploadMessage}</p>}
  {preview&&preview.household===household&&<div className="account-sync-preview" role="status"><p><strong>On this device:</strong> {preview.localCount} records</p><p><strong>In the cloud:</strong> {preview.remoteCount} records</p>
   <p><strong>Equipment details (excluding attachment encoding):</strong> {preview.decision==="upload-local"?"Local inventory exists; cloud inventory is empty.":preview.decision==="download-remote"?"Cloud inventory exists; device inventory is empty.":preview.decision==="identical"?"The records match.":preview.decision==="empty"?"Both inventories are empty.":"Differences need review before any transfer."}</p>
   {preview.decision==="review-required"&&<p>Device-only: {preview.localOnly} · Cloud-only: {preview.remoteOnly} · Changed: {preview.changed}</p>}
   {preview.conflicts.length>0&&<div><h4>Review equipment differences</h4><p>Read-only preview. No device or cloud records will be changed.</p><ul>{preview.conflicts.slice(0,25).map(conflict=><li key={conflict.id}><strong>{conflict.name}</strong> — {conflict.status==="different"?"Different fields: "+conflict.fields.join(", "):conflict.status==="device-only"?"Only on this device":"Only in cloud"}</li>)}</ul>{preview.conflicts.length>25&&<p>Showing 25 of {preview.conflicts.length} records.</p>}</div>}
   {preview.conflicts.length>0&&<div>
    <h4>Prepare conflict decisions</h4>
    <p>Cloud-only imports and device-only uploads are additive. For changed records, choosing Keep device allows an explicitly confirmed, revision-checked replacement of the cloud version. Download a complete cloud backup first.</p>
    {preview.conflicts.map(conflict=><div key={conflict.id} className="account-inline-form">
     <label htmlFor={"conflict-"+conflict.id}>{conflict.name}</label>
     <select id={"conflict-"+conflict.id} value={choices[conflict.id]??""} onChange={e=>setChoices(previous=>({...previous,[conflict.id]:e.target.value as ConflictChoice}))}>
      <option value="">Choose action</option>
      <option value="keep-device">Keep device version</option>
      <option value="keep-cloud">Keep cloud version</option>
      <option value="skip">Skip for now</option>
     </select>
     {conflict.status==="different"&&choices[conflict.id]==="keep-device"&&<button type="button" className="secondary" disabled={busy} onClick={()=>void uploadApprovedChangedRecord(conflict.id)}>Replace cloud record (confirmation required)</button>}
     {conflict.status==="cloud-only"&&choices[conflict.id]==="keep-cloud"&&<button type="button" className="secondary" disabled={busy} onClick={()=>void importCloudOnlyRecord(conflict.id)}>Import into device (confirmation required)</button>}
     {conflict.status==="device-only"&&choices[conflict.id]==="keep-device"&&<button type="button" className="secondary" disabled={busy} onClick={()=>void uploadApprovedNewRecord(conflict.id)}>Upload this new record (confirmation required)</button>}
    </div>)}
    {validateConflictApprovals(preview.conflicts,Object.entries(choices).map(([id,choice])=>({id,choice})))&&
     <p role="status">Review plan complete. No changes have been applied.</p>}
   </div>}
   <p><strong>Attachment audit:</strong> {preview.attachments} device references · {preview.cloudAttachments} cloud references · {preview.verifiedFiles} verified private files · {preview.missingFiles} missing/inaccessible files · {preview.invalidReferences} invalid cloud references.</p>
   {(preview.missingFiles>0||preview.invalidReferences>0)&&<p role="alert">Some cloud attachments need review. No files or records have been changed.</p>}
   <p><strong>No transfer has occurred from comparison.</strong> Export a JSON backup before any upload. Automatic two-way sync is not enabled. Cloud backup downloads never overwrite this device.</p>
   {preview.remoteCount>0&&preview.missingFiles===0&&preview.invalidReferences===0&&<button type="button" className="secondary" disabled={busy} onClick={()=>void downloadCloudBackup()}>{busy?"Working…":"Download complete cloud backup (no device changes)"}</button>}
   {preview.decision==="upload-local"&&<button type="button" className="secondary" disabled={busy} onClick={()=>void uploadFirstCopy()}>{busy?"Uploading…":"Upload first cloud copy (confirmation required)"}</button>}</div>}
 </div>;
}
