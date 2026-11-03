import {useEffect,useRef,useState} from "react";
type Household={id:string;name:string};
type RevisionRow={item_id:string;revision:string;updated_at:string};
type Client = { from: (table:string) => { select: (columns:string) => { eq: (column:string,value:string) => { order: (column:string,options:{ascending:boolean}) => Promise<{data:RevisionRow[]|null;error:{message:string}|null}> } } } };
export default function CloudRevisionPullPreview({client,households}:{client:Client;households:Household[]}){
 const [householdId,setHouseholdId]=useState("");
 const [rows,setRows]=useState<RevisionRow[]>([]);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const requestId=useRef(0);
 useEffect(()=>()=>{requestId.current++;},[]);
 useEffect(()=>{requestId.current++;setRows([]);setStatus("");setBusy(false);},[client]);
 useEffect(()=>{if(householdId&&!households.some(h=>h.id===householdId)){requestId.current++;setHouseholdId("");setRows([]);setStatus("");setBusy(false);}},[households,householdId]);
 async function load(){
  if(busy||!households.some(h=>h.id===householdId))return;
  const request=++requestId.current;
  setBusy(true);setRows([]);setStatus("");
  try{
   const {data,error}=await client.from("inventory_revisions").select("item_id,revision,updated_at").eq("household_id",householdId).order("updated_at",{ascending:false});
   if(request!==requestId.current)return;
   if(error)throw new Error("Could not read cloud revisions");
   const all=data??[];
   const visible=all.filter(row=>!row.item_id.startsWith("__housevault_test_"));
   setRows(visible);
   setStatus(visible.length+" inventory revisions found ("+(all.length-visible.length)+" test records hidden). Preview only; no local inventory was modified.");
  }catch{if(request===requestId.current)setStatus("Cloud revision preview failed. No local inventory was modified.");}
  finally{if(request===requestId.current)setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud revision preview</h3><p className="account-helper">Read-only list of cloud revision metadata. No records are imported, replaced, or synchronized.</p><label htmlFor="revision-pull-household">Household</label><select id="revision-pull-household" value={householdId} onChange={e=>{requestId.current++;setHouseholdId(e.target.value);setRows([]);setStatus("");setBusy(false);}}><option value="">Select household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={!householdId||busy} onClick={()=>void load()}>{busy?"Loading…":"Preview cloud revisions"}</button>{status&&<p role="status" className="account-feedback">{status}</p>}{rows.length>0&&<ul className="account-household-list">{rows.slice(0,25).map(row=><li key={row.item_id}><div><strong>{row.item_id}</strong><small>Revision: {row.revision}</small></div></li>)}</ul>}{rows.length>25&&<p className="account-helper">Showing first 25 records.</p>}</section>;
}
