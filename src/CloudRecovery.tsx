import {useState} from "react";
import {requestCloudRestore,eligibleRestore,type DeletedCloudRow} from "./cloudRestoreApi";

type Client={
 from:(table:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{limit:(count:number)=>Promise<{data:DeletedCloudRow[]|null;error:{message:string}|null}>}}};
 rpc:Parameters<typeof requestCloudRestore>[0]["rpc"];
};
export default function CloudRecovery({client,household}:{client:Client;household:string}){
 const [rows,setRows]=useState<DeletedCloudRow[]>([]);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  if(!household||busy)return;
  setBusy(true);
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,deleted_at,payload").eq("household_id",household).limit(1001);
   if(error||!data||data.length>1000)throw new Error("Could not safely list cloud records");
   setRows(data.filter(row=>row.deleted_at&&eligibleRestore(row)&&!row.item_id.startsWith("__housevault_test_")));
   setStatus("Recovery list refreshed.");
  }catch{setStatus("Could not load deleted records.");}finally{setBusy(false);}
 }
 async function restore(row:DeletedCloudRow){
  if(busy||!window.confirm('Restore cloud inventory record "'+row.payload.name+'"? This makes it available for synchronization again.'))return;
  setBusy(true);
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,deleted_at,payload").eq("household_id",household).limit(1001);
   if(error||!data||data.length>1000)throw new Error("Could not verify restore candidate");
   const latest=data.find(item=>item.item_id===row.item_id);
   if(!latest||latest.revision!==row.revision||!eligibleRestore(latest))throw new Error("Record changed; refresh first");
   await requestCloudRestore(client,household,latest,true);
   setRows(current=>current.filter(item=>item.item_id!==row.item_id));
   setStatus("Cloud record restored. Automatic import may retrieve it when enabled.");
  }catch(error){setStatus(error instanceof Error?error.message:"Restore failed");}finally{setBusy(false);}
 }
 return <div className="account-card"><h4>Recover deleted cloud inventory</h4><p>Restoring makes retained records visible in cloud inventory again. No local records are overwritten.</p><button type="button" disabled={!household||busy} onClick={()=>void refresh()}>Find deleted records</button><p role="status">{status}</p><ul>{rows.slice(0,20).map(row=><li key={row.item_id}>{row.payload.name} <button type="button" disabled={busy} onClick={()=>void restore(row)}>Restore cloud copy</button></li>)}</ul>{rows.length>20&&<p>Showing first 20 records.</p>}</div>;
}
