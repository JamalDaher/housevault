import { useEffect, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key):null;
type Household={id:string;name:string;created_by:string};
type Entry={household_id:string;name?:string;path?:string};
export default function HouseholdTaxonomy({session,households}:{session:Session;households:Household[]}){
 const [household,setHousehold]=useState("");
 const [categories,setCategories]=useState<string[]>([]);
 const [locations,setLocations]=useState<string[]>([]);
 const [role,setRole]=useState("");
 const [category,setCategory]=useState("");
 const [location,setLocation]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{if(!client||!household){return;}let active=true;const db=client;
  void Promise.all([
   db.from("household_categories").select("household_id,name").eq("household_id",household),
   db.from("household_locations").select("household_id,path").eq("household_id",household),
   db.from("household_members").select("role").eq("household_id",household).eq("user_id",session.user.id).single()
  ]).then(([a,b,c])=>{if(!active)return;if(a.error||b.error||c.error){setMessage("Could not load household organization. The taxonomy migration may not be deployed.");return;}
   setCategories((a.data as Entry[]??[]).map(x=>x.name??""));setLocations((b.data as Entry[]??[]).map(x=>x.path??""));setRole(c.data?.role??"");
  });return()=>{active=false;};
 },[household,session.user.id]);
 async function change(kind:"category"|"location",action:"add"|"remove",value:string){
  if(!client||!household||!["owner","editor"].includes(role)||busy)return;
  const cleaned=value.trim();if(!cleaned)return;
  setBusy(true);setMessage("");
  const {error}=await client.rpc("manage_household_taxonomy",{target_household:household,target_kind:kind,target_value:cleaned,target_action:action});
  if(error)setMessage("Could not update the shared "+kind+".");
  else{const update=kind==="category"?setCategories:setLocations;update(old=>action==="add"?[...new Set([...old,cleaned])].sort():old.filter(x=>x!==cleaned));setMessage("Shared "+kind+" "+(action==="add"?"saved.":"removed from the list. Existing inventory records are unchanged."));if(kind==="category")setCategory("");else setLocation("");}
  setBusy(false);
 }
 function add(event:FormEvent<HTMLFormElement>,kind:"category"|"location"){event.preventDefault();void change(kind,"add",kind==="category"?category:location);}
 const canEdit=role==="owner"||role==="editor";
 return <div className="account-card account-wide"><div className="account-section-heading"><div><span className="account-kicker">SHARED ORGANIZATION</span><h3>Categories & locations</h3><p>Shared lists for your household. Editors and owners can add or remove entries; existing inventory is never changed by removing a list entry.</p></div></div>
 <label htmlFor="taxonomy-household">Household</label><select id="taxonomy-household" value={household} onChange={e=>{setHousehold(e.target.value);setCategories([]);setLocations([]);setRole("");setMessage("");}}><option value="">Select a household</option>{households.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select>
 {household&&<div className="account-taxonomy-grid">{([["category",categories,category,setCategory,"Category name (e.g. Garden)"],["location",locations,location,setLocation,"Location path (e.g. House / Garage / Shelf)"]] as const).map(([kind,entries,value,setValue,placeholder])=><section key={kind}><h4>{kind==="category"?"Categories":"Locations"} ({entries.length})</h4>{canEdit&&<form className="account-inline-form" onSubmit={e=>add(e,kind)}><div><label htmlFor={"taxonomy-"+kind}>New {kind}</label><input id={"taxonomy-"+kind} value={value} maxLength={kind==="category"?60:240} placeholder={placeholder} onChange={e=>setValue(e.target.value)}/></div><button type="submit" disabled={busy||!value.trim()}>Add</button></form>}
 <ul className="account-members-list">{entries.map(entry=><li key={entry}><span>{entry}</span>{canEdit&&<button className="secondary" type="button" disabled={busy} onClick={()=>void change(kind,"remove",entry)}>Remove</button>}</li>)}</ul>{!entries.length&&<p className="account-empty">No shared {kind==="category"?"categories":"locations"} yet.</p>}</section>)}</div>}
 {message&&<p role="status" className="account-feedback">{message}</p>}
 <p className="account-helper">This is the shared list foundation. Existing local inventory and its category/location values stay unchanged. Linking these lists to the item editor and syncing them across devices is a subsequent step.</p>
 </div>;
}
