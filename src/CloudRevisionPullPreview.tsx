import {useState} from "react";
type Household={id:string;name:string};
type RevisionRow={item_id:string;revision:string;updated_at:string};
type Client = { from: (table:string) => { select: (columns:string) => { eq: (column:string,value:string) => { order: (column:string,options:{ascending:boolean}) => Promise<{data:RevisionRow[]|null;error:{message:string}|null}> } } } };
export default function CloudRevisionPullPreview({client,households}:{client:Client;households:Household[]}){
 const [householdId,setHouseholdId]=useState("");
 const [rows,setRows]=useState<RevisionRow[]>([]);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(){
  if(busy||!households.some(h=>h.id===householdId))return;
  setBusy(true);setRows([]);setStatus("");
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,updated_at").eq("household_id",householdId).order("updated_at",{ascending:false});
   if(error)throw new Error("Could not read cloud revisions");
   setRows(data??[]);
   setStatus((data?.length??0)+" cloud revision records found. Preview only; no local inventory was modified.");
  }catch{setStatus("Cloud revision preview failed. No local inventory was modified.");}
  finally{setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud revision preview</h3><p className="account-helper">Read-only list of cloud revision metadata. No records are imported, replaced, or synchronized.</p><label htmlFor="revision-pull-household">Household</label><select id="revision-pull-household" value={householdId} onChange={e=>{setHouseholdId(e.target.value);setRows([]);setStatus("");}}><option value="">Select household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={!householdId||busy} onClick={()=>void load()}>{busy?"Loading…":"Preview cloud revisions"}</button>{status&&<p role="status" className="account-feedback">{status}</p>}{rows.length>0&&<ul className="account-household-list">{rows.slice(0,25).map(row=><li key={row.item_id}><div><strong>{row.item_id}</strong><small>Revision: {row.revision}</small></div></li>)}</ul>}{rows.length>25&&<p className="account-helper">Showing first 25 records.</p>}</section>;
}
