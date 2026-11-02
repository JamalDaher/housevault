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
 useEffect(()=>{
  if(!client)return;
  let mounted=true;
  void client.auth.getSession().then(({data,error})=>{if(mounted){setSession(data.session);if(error)setMessage("Could not restore account session.");}});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next);});
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 async function requestLink(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||busy)return;
  setBusy(true);setMessage("");
  const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+window.location.pathname,shouldCreateUser:true}});
  setBusy(false);setMessage(error?"Could not send a sign-in link. Check the address and try again.":"Check your email for a sign-in link. Open it on this device.");
 }
 async function signOut(){if(!client||busy)return;setBusy(true);const {error}=await client.auth.signOut();setBusy(false);setMessage(error?"Sign-out failed. Try again.":"Signed out.");}
 if(!client)return <div className="account-status"><div><strong>Cloud sign-in not enabled on this deployment</strong><p>Configure the Supabase publishable URL and key in the deployment environment. Your inventory remains local.</p></div></div>;
 return <div className="cloud-account"><h3>Cloud account</h3>{session?<><p>Signed in as <strong>{session.user.email??"an account"}</strong>.</p><button type="button" disabled={busy} onClick={()=>void signOut()}>Sign out</button></>:<form onSubmit={e=>void requestLink(e)}><label htmlFor="cloud-email">Email address</label><input id="cloud-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button type="submit" disabled={busy}>{busy?"Sending…":"Email me a sign-in link"}</button></form>}{message&&<p role="status">{message}</p>}<p className="account-note">Account sign-in only. Household access, uploads, and cloud sync are not enabled. Your device inventory is unchanged.</p></div>;
}
