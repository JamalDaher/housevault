import {useState} from "react";
import {inspectHouseholdCloudReadiness,type CloudReadinessDatabase} from "./cloudReadinessService";
export default function CloudReadinessCheck({client,userId,households}:{client:CloudReadinessDatabase;userId:string;households:{id:string;name:string}[]}){
 const [householdId,setHouseholdId]=useState("");
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 async function check(){
  if(!households.some(h=>h.id===householdId))return;
  setBusy(true);setStatus("");
  try{
   const result=await inspectHouseholdCloudReadiness(client,userId,householdId);
   setStatus(result.ready?`Cloud revision storage is readable (${result.recordCount} records). This does not enable synchronization.`:result.issues.join(" ")||"Cloud storage is not ready.");
  }finally{setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud readiness</h3><p className="account-helper">Optional read-only database check. No inventory is uploaded or changed.</p><label htmlFor="cloud-readiness-household">Household</label><select id="cloud-readiness-household" value={householdId} onChange={e=>{setHouseholdId(e.target.value);setStatus("");}}><option value="">Select household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={busy||!householdId} onClick={()=>void check()}>{busy?"Checking…":"Check cloud access"}</button>{status&&<p role="status" className="account-feedback">{status}</p>}</section>;
}
