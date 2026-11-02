import { useEffect, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

export default function CloudAccount(){
 const [session,setSession]=useState<Session|null>(null);
 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [households,setHouseholds]=useState<{id:string;name:string;created_by:string}[]>([]);
 const [householdName,setHouseholdName]=useState("");
 const [householdBusy,setHouseholdBusy]=useState(false);
 const [householdError,setHouseholdError]=useState("");
 const [householdLoading,setHouseholdLoading]=useState(false);
 useEffect(()=>{
  if(!client)return;
  let mounted=true;
  void client.auth.getSession().then(({data,error})=>{if(mounted){setSession(data.session);if(error)setMessage("Could not restore account session.");}});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next);if(!next){setHouseholds([]);setHouseholdError("");}});
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  if(!client||!session?.user.id){return;}
  let mounted=true;
  const db=client;
  void (async()=>{
   setHouseholdLoading(true);setHouseholdError("");
   const {data,error}=await db.from("households").select("id,name,created_by").order("created_at",{ascending:true});
   if(mounted){setHouseholds(data??[]);setHouseholdError(error?"Could not load households. Try signing out and in again.":"");setHouseholdLoading(false);}
  })();
  return()=>{mounted=false;};
 },[session?.user.id]);
 async function createHousehold(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||!session||householdBusy)return;
  const name=householdName.trim();if(!name||name.length>120){setHouseholdError("Enter a household name of 1–120 characters.");return;}
  setHouseholdBusy(true);setHouseholdError("");
  const {data,error}=await client.from("households").insert({name,created_by:session.user.id}).select("id,name,created_by").single();
  if(error||!data){setHouseholdError("Could not create household. Check your connection and try again.");}
  else{setHouseholds(old=>old.some(h=>h.id===data.id)?old:[...old,data]);setHouseholdName("");setMessage("Household created. Inventory is still stored only on this device.");}
  setHouseholdBusy(false);
 }
 async function requestLink(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||busy)return;
  setBusy(true);setMessage("");
  const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+window.location.pathname,shouldCreateUser:true}});
  setBusy(false);setMessage(error?"Could not send a sign-in link. Check the address and try again.":"Check your email for a sign-in link. Open it on this device.");
 }
 async function signOut(){if(!client||busy)return;setBusy(true);const {error}=await client.auth.signOut();setBusy(false);setMessage(error?"Sign-out failed. Try again.":"Signed out.");}
 if(!client)return <div className="account-status"><div><strong>Cloud sign-in not enabled on this deployment</strong><p>Configure the Supabase publishable URL and key in the deployment environment. Your inventory remains local.</p></div></div>;
 return <div className="cloud-account"><h3>Cloud account</h3>{session?<><p>Signed in as <strong>{session.user.email??"an account"}</strong>.</p><button type="button" disabled={busy} onClick={()=>void signOut()}>Sign out</button><div className="household-management"><h3>Households</h3><p>Private workspaces for future family sharing. Creating one does not upload your inventory.</p>{householdLoading?<p role="status">Loading households…</p>:<ul>{households.map(h=><li key={h.id}><strong>{h.name}</strong> {h.created_by===session.user.id?"(owner)":"(member)"}</li>)}</ul>}{!householdLoading&&households.length===0&&!householdError&&<p>No households yet.</p>}<form onSubmit={e=>void createHousehold(e)}><label htmlFor="household-name">New household name</label><input id="household-name" required maxLength={120} value={householdName} onChange={e=>setHouseholdName(e.target.value)} placeholder="My home"/><button type="submit" disabled={householdBusy}>{householdBusy?"Creating…":"Create household"}</button></form>{householdError&&<p role="alert">{householdError}</p>}</div></>:<form onSubmit={e=>void requestLink(e)}><label htmlFor="cloud-email">Email address</label><input id="cloud-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button type="submit" disabled={busy}>{busy?"Sending…":"Email me a sign-in link"}</button></form>}{message&&<p role="status">{message}</p>}<p className="account-note">Household creation is enabled. Invitations, uploads, and cloud sync are not enabled. Your device inventory is unchanged.</p></div>;
}
