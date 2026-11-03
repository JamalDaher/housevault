import {useEffect,useRef,useState} from "react";
import {requestCloudRestore,eligibleRestore,type DeletedCloudRow} from "./cloudRestoreApi";

type Client={
 from:(table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{limit:(count:number)=>Promise<{data:(Omit<DeletedCloudRow,"deleted_at">&{deleted_at?:string|null})[]|null;error:{message:string}|null}>}}};
 rpc:Parameters<typeof requestCloudRestore>[0]["rpc"];
};
export default function CloudRecovery({client,household}:{client:Client;household:string}){
 const [rows,setRows]=useState<DeletedCloudRow[]>([]);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function refresh(){
  if(!household||busy)return;
  setBusy(true);
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,deleted_at,payload").eq("household_id",household).limit(1001);
   if(error||!data||data.length>1000)throw new Error("Could not safely list cloud records");
   if(!active.current)return;
   setRows(data.filter(row=>row.deleted_at&&eligibleRestore({...row,deleted_at:row.deleted_at??null})&&!row.item_id.startsWith("__housevault_test_")).map(row=>({...row,deleted_at:row.deleted_at??null})));
   setStatus("Recovery list refreshed.");
  }catch{if(active.current)setStatus("Could not load deleted records.");}finally{if(active.current)setBusy(false);}
 }
 async function restore(row:DeletedCloudRow){
  if(busy||!window.confirm('Restore cloud inventory record "'+row.payload.name+'"? This makes it available for synchronization again.'))return;
  setBusy(true);
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,deleted_at,payload").eq("household_id",household).limit(1001);
   if(error||!data||data.length>1000)throw new Error("Could not verify restore candidate");
   const latest=data.find(item=>item.item_id===row.item_id);
   if(!latest||latest.revision!==row.revision||!eligibleRestore({...latest,deleted_at:latest.deleted_at??null}))throw new Error("Record changed; refresh first");
   if(!active.current)throw new Error("Household changed; restore cancelled");
   await requestCloudRestore(client,household,{...latest,deleted_at:latest.deleted_at??null},true);
   if(!active.current)return;
   setRows(current=>current.filter(item=>item.item_id!==row.item_id));
   setStatus("Cloud record restored. Automatic import may retrieve it when enabled.");
  }catch(error){if(active.current)setStatus(error instanceof Error?error.message:"Restore failed");}finally{if(active.current)setBusy(false);}
 }
 return <div className="account-card"><h4>Recover deleted cloud inventory</h4><p>Restoring makes retained records visible in cloud inventory again. No local records are overwritten.</p><button type="button" disabled={!household||busy} onClick={()=>void refresh()}>Find deleted records</button><p role="status">{status}</p><ul>{rows.slice(0,20).map(row=><li key={row.item_id}>{row.payload.name} <button type="button" disabled={busy} onClick={()=>void restore(row)}>Restore cloud copy</button></li>)}</ul>{rows.length>20&&<p>Showing first 20 records.</p>}</div>;
}
