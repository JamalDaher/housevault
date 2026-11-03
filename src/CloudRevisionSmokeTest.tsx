import {useState} from "react";
import {createCloudRevisionApi} from "./cloudRevisionApi";

type Client=Parameters<typeof createCloudRevisionApi<Record<string,unknown>>>[0];
type Household={id:string;name:string;created_by:string};

export default function CloudRevisionSmokeTest({client,userId,households}:{client:Client;userId:string;households:Household[]}){
 const [householdId,setHouseholdId]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 const testHouseholds=households.filter(h=>h.created_by===userId&&h.name==="HouseVault Sync Test");
 async function run(){
  const selected=testHouseholds.find(h=>h.id===householdId);
  if(!selected||busy)return;
  if(!window.confirm("Write disposable test records to the selected HouseVault Sync Test household? Records will remain in that test household. No local inventory will change."))return;
  setBusy(true);setStatus("");
  const itemId="__housevault_test_"+crypto.randomUUID();
  const api=createCloudRevisionApi<Record<string,unknown>>(client,selected.id);
  try{
   if(await api.read(itemId)!==null)throw new Error("Test item unexpectedly exists");
   const first=await api.write({itemId,expectedRevision:null,value:{smoke_test:true,step:1}});
   if(first.status!=="saved")throw new Error("Initial write failed");
   const read=await api.read(itemId);
   if(read?.revision!==first.revision||read.value.step!==1)throw new Error("Readback mismatch");
   const second=await api.write({itemId,expectedRevision:first.revision,value:{smoke_test:true,step:2}});
   if(second.status!=="saved"||second.revision===first.revision)throw new Error("Revision update failed");
   const stale=await api.write({itemId,expectedRevision:first.revision,value:{smoke_test:true,step:"stale"}});
   if(stale.status!=="conflict"||stale.revision!==second.revision)throw new Error("Stale write was not rejected");
   const final=await api.read(itemId);
   if(final?.revision!==second.revision||final.value.step!==2)throw new Error("Conflict overwrote the record");
   setStatus("PASS: create, read, update, conflict rejection, and unchanged data. Test record remains in the isolated household. Cross-user permissions are not tested.");
  }catch{
   setStatus("Test did not pass. The test household may contain a partial test record; no local inventory was changed.");
  }finally{setBusy(false);}
 }
 return <section className="account-card"><h3>Cloud write smoke test</h3><p className="account-helper">Opt-in test only. Create a separate household named exactly “HouseVault Sync Test” while signed in as a dedicated test account. Writes remain in that test household; no automatic cleanup or synchronization.</p><label htmlFor="revision-smoke-household">Test household</label><select id="revision-smoke-household" value={householdId} onChange={e=>{setHouseholdId(e.target.value);setStatus("");}}><option value="">Select test household</option>{testHouseholds.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><button type="button" disabled={!householdId||busy} onClick={()=>void run()}>{busy?"Testing…":"Run cloud write test"}</button>{!testHouseholds.length&&<p className="account-helper">No eligible test household found. Regular households cannot be selected.</p>}{status&&<p role="status" className="account-feedback">{status}</p>}</section>;
}
