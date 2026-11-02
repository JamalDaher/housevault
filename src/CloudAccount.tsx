import { useEffect, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

export default function CloudAccount(){
 const [session,setSession]=useState<Session|null>(null);
 const [email,setEmail]=useState("");
 const [pendingEmail,setPendingEmail]=useState("");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [households,setHouseholds]=useState<{id:string;name:string;created_by:string}[]>([]);
 const [householdName,setHouseholdName]=useState("");
 const [householdBusy,setHouseholdBusy]=useState(false);
 const [householdError,setHouseholdError]=useState("");
 const [householdLoading,setHouseholdLoading]=useState(false);
 const [invites,setInvites]=useState<{id:string;household_id:string;invited_email:string;role:string;expires_at:string;accepted_at:string|null;revoked_at:string|null}[]>([]);
 const [inviteHousehold,setInviteHousehold]=useState("");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteRole,setInviteRole]=useState<"viewer"|"editor">("viewer");
 const [acceptId,setAcceptId]=useState("");
 const [inviteBusy,setInviteBusy]=useState(false);
 const [inviteMessage,setInviteMessage]=useState("");

 useEffect(()=>{
  if(!client)return;
  let mounted=true;
  void client.auth.getSession().then(({data,error})=>{if(mounted){setSession(data.session);if(error)setMessage("Could not restore account session.");}});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{if(mounted)setSession(next);if(!next){setHouseholds([]);setInvites([]);setHouseholdError("");}});
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
 async function refreshInvites(){
  if(!client||!session)return;
  const {data,error}=await client.from("household_invitations").select("id,household_id,invited_email,role,expires_at,accepted_at,revoked_at").order("created_at",{ascending:false});
  if(error)setInviteMessage("Could not load invitations.");
  else setInvites(data??[]);
 }
 useEffect(()=>{
  if(!client||!session?.user.id)return;
  let active=true;
  void client.from("household_invitations").select("id,household_id,invited_email,role,expires_at,accepted_at,revoked_at").order("created_at",{ascending:false}).then(({data,error})=>{
   if(active){if(error)setInviteMessage("Could not load invitations.");else setInvites(data??[]);}
  });
  return()=>{active=false;};
 },[session?.user.id]);
 async function sendInvite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||!session||inviteBusy)return;
  const target=households.find(h=>h.id===inviteHousehold&&h.created_by===session.user.id);
  if(!target){setInviteMessage("Select a household you own.");return;}
  setInviteBusy(true);setInviteMessage("");
  const {data,error}=await client.rpc("create_household_invitation",{target_household:target.id,target_email:inviteEmail.trim(),target_role:inviteRole});
  if(error||!data)setInviteMessage("Invitation could not be created. Confirm your owner access and email address.");
  else{setInviteMessage("Invitation created. Copy its invitation ID from the list and share it privately with the recipient. No invitation email is sent automatically.");setInviteEmail("");await refreshInvites();}
  setInviteBusy(false);
 }
 async function acceptInvite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||inviteBusy)return;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(acceptId.trim())){setInviteMessage("Enter a valid invitation ID.");return;}
  setInviteBusy(true);setInviteMessage("");
  const {error}=await client.rpc("accept_household_invitation",{invitation_id:acceptId.trim()});
  if(error)setInviteMessage("Could not accept invitation. Check that it is valid, unexpired, and addressed to your verified sign-in email.");
  else{setInviteMessage("Invitation accepted. Refresh the app to see your new household.");setAcceptId("");}
  setInviteBusy(false);
 }
 async function revokeInvite(id:string){
  if(!client||inviteBusy)return;
  setInviteBusy(true);setInviteMessage("");
  const {error}=await client.rpc("revoke_household_invitation",{invitation_id:id});
  setInviteMessage(error?"Could not revoke invitation.":"Invitation revoked.");
  if(!error)await refreshInvites();
  setInviteBusy(false);
 }
 async function requestLink(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||busy)return;
  setBusy(true);setMessage("");
  const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+window.location.pathname,shouldCreateUser:true}});
  setBusy(false);if(!error){setPendingEmail(email.trim());setCode("");}setMessage(error?"Could not send a sign-in email. Check the address and try again.":"Check your email for a sign-in code. If you only see a link, the Supabase email template must be updated to include the token.");
 }
 async function verifyCode(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!client||busy||!pendingEmail)return;
  if(!/^[0-9]{6,8}$/.test(code.trim())){setMessage("Enter the full six- or eight-digit code from your email.");return;}
  setBusy(true);setMessage("");
  const {error}=await client.auth.verifyOtp({email:pendingEmail,token:code.trim(),type:"email"});
  setBusy(false);
  if(error)setMessage("That code could not be verified. Check it or request a new code.");
  else{setPendingEmail("");setCode("");setMessage("Signed in on this device.");}
 }
 async function signOut(){if(!client||busy)return;setBusy(true);const {error}=await client.auth.signOut();setBusy(false);setMessage(error?"Sign-out failed. Try again.":"Signed out.");}
 if(!client)return <div className="account-status"><div><strong>Cloud sign-in not enabled on this deployment</strong><p>Configure the Supabase publishable URL and key in the deployment environment. Your inventory remains local.</p></div></div>;
 return <div className="cloud-account"><h3>Cloud account</h3>{session?<><p>Signed in as <strong>{session.user.email??"an account"}</strong>.</p><button type="button" disabled={busy} onClick={()=>void signOut()}>Sign out</button><div className="household-management"><h3>Households</h3><p>Private workspaces for future family sharing. Creating one does not upload your inventory.</p>{householdLoading?<p role="status">Loading households…</p>:<ul>{households.map(h=><li key={h.id}><strong>{h.name}</strong> {h.created_by===session.user.id?"(owner)":"(member)"}</li>)}</ul>}{!householdLoading&&households.length===0&&!householdError&&<p>No households yet.</p>}<form onSubmit={e=>void createHousehold(e)}><label htmlFor="household-name">New household name</label><input id="household-name" required maxLength={120} value={householdName} onChange={e=>setHouseholdName(e.target.value)} placeholder="My home"/><button type="submit" disabled={householdBusy}>{householdBusy?"Creating…":"Create household"}</button></form>{householdError&&<p role="alert">{householdError}</p>}<div className="household-management"><h3>Invite family</h3><p>Household owners can create seven-day invitations. This version does not send invitation emails; share the invitation ID privately. Shared inventory is not yet enabled.</p><form onSubmit={e=>void sendInvite(e)}><label htmlFor="invite-household">Household</label><select id="invite-household" required value={inviteHousehold} onChange={e=>setInviteHousehold(e.target.value)}><option value="">Select your household</option>{households.filter(h=>h.created_by===session.user.id).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><label htmlFor="invite-email">Family member email</label><input id="invite-email" type="email" required maxLength={320} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="family@example.com"/><label htmlFor="invite-role">Access role</label><select id="invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as "viewer"|"editor")}><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button type="submit" disabled={inviteBusy||!households.some(h=>h.created_by===session.user.id)}>{inviteBusy?"Working…":"Create invitation"}</button></form>{invites.length>0&&<div><h4>Invitations you manage</h4><ul>{invites.map(inv=><li key={inv.id}><strong>{inv.invited_email}</strong> ({inv.role}) — {inv.revoked_at?"Revoked":inv.accepted_at?"Accepted":new Date(inv.expires_at).getTime()<=Date.now()?"Expired":"Pending"}<p>Invitation ID: <code>{inv.id}</code></p>{!inv.revoked_at&&!inv.accepted_at&&<button type="button" disabled={inviteBusy} onClick={()=>void revokeInvite(inv.id)}>Revoke invitation</button>}</li>)}</ul></div>}<h4>Accept an invitation</h4><p>Sign in with the email address that was invited, then enter the invitation ID shared with you.</p><form onSubmit={e=>void acceptInvite(e)}><label htmlFor="accept-invite">Invitation ID</label><input id="accept-invite" required value={acceptId} onChange={e=>setAcceptId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/><button type="submit" disabled={inviteBusy}>{inviteBusy?"Working…":"Accept invitation"}</button></form>{inviteMessage&&<p role="status">{inviteMessage}</p>}</div></div></>:<><form onSubmit={e=>void requestLink(e)}><label htmlFor="cloud-email">Email address</label><input id="cloud-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button type="submit" disabled={busy}>{busy?"Sending…":pendingEmail?"Send a new code":"Email me a sign-in code"}</button></form>{pendingEmail&&<form onSubmit={e=>void verifyCode(e)}><p>Code sent to <strong>{pendingEmail}</strong></p><label htmlFor="cloud-otp">Email verification code</label><input id="cloud-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,8))} placeholder="Enter your email code"/><button type="submit" disabled={busy}>{busy?"Verifying…":"Verify code and sign in"}</button></form>}</>}{message&&<p role="status">{message}</p>}<p className="account-note">Household creation is enabled. Invitation IDs can be shared privately. Invitation email delivery, uploads, and cloud inventory sync are not enabled. Your device inventory is unchanged.</p></div>;
}
