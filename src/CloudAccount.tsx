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
 return <div className="cloud-account">
  <div className="account-profile-card">
   <div className="account-profile-icon" aria-hidden="true">{session?"✓":"@"}</div>
   <div className="account-profile-details"><span className="account-kicker">HOUSEVAULT ACCOUNT</span><h3>{session?"You're signed in":"Sign in to HouseVault"}</h3><p>{session?session.user.email:"Use a one-time code sent to your email. No password required."}</p></div>
   <span className={"account-state-pill "+(session?"is-connected":"")}>{session?"Connected":"Not signed in"}</span>
  </div>
  {session?<div className="account-signout-row"><span>Account access is active on this device.</span><button type="button" className="secondary" disabled={busy} onClick={()=>void signOut()}>{busy?"Signing out…":"Sign out"}</button></div>:<div className="account-card account-login-card"><div className="account-section-heading"><div><h3>Email verification</h3><p>Enter your email to receive a sign-in code.</p></div></div><form className="account-form" onSubmit={e=>void requestLink(e)}><label htmlFor="cloud-email">Email address</label><input id="cloud-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button type="submit" disabled={busy}>{busy?"Sending…":pendingEmail?"Send another code":"Send sign-in code"}</button></form>{pendingEmail&&<form className="account-form account-code-form" onSubmit={e=>void verifyCode(e)}><p>Code sent to <strong>{pendingEmail}</strong></p><label htmlFor="cloud-otp">Verification code</label><input id="cloud-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,8))} placeholder="Enter your email code"/><button type="submit" disabled={busy}>{busy?"Verifying…":"Verify and sign in"}</button></form>}</div>}
  {message&&<p className="account-feedback" role="status">{message}</p>}
  {session&&<div className="account-workspace">
   <div className="account-card"><div className="account-section-heading"><div><span className="account-kicker">WORKSPACES</span><h3>Households</h3><p>Private spaces for organizing family access.</p></div><span className="account-count">{households.length}</span></div>
    {householdLoading?<p role="status">Loading households…</p>:households.length?<ul className="account-household-list">{households.map(h=><li key={h.id}><span className="account-household-avatar" aria-hidden="true">⌂</span><div><strong>{h.name}</strong><small>{h.created_by===session.user.id?"Owner":"Member"}</small></div></li>)}</ul>:<p className="account-empty">No households yet. Create your first workspace below.</p>}
    <form className="account-inline-form" onSubmit={e=>void createHousehold(e)}><div><label htmlFor="household-name">New household</label><input id="household-name" required maxLength={120} value={householdName} onChange={e=>setHouseholdName(e.target.value)} placeholder="e.g. Our Home"/></div><button type="submit" disabled={householdBusy}>{householdBusy?"Creating…":"Create household"}</button></form>{householdError&&<p role="alert" className="account-feedback">{householdError}</p>}
   </div>
   <div className="account-card"><div className="account-section-heading"><div><span className="account-kicker">FAMILY ACCESS</span><h3>Invite a member</h3><p>Choose a household and assign access. Invitations expire after seven days.</p></div></div>
    <form className="account-form" onSubmit={e=>void sendInvite(e)}><label htmlFor="invite-household">Household</label><select id="invite-household" required value={inviteHousehold} onChange={e=>setInviteHousehold(e.target.value)}><option value="">Select your household</option>{households.filter(h=>h.created_by===session.user.id).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><label htmlFor="invite-email">Member's email</label><input id="invite-email" type="email" required maxLength={320} value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="family@example.com"/><label htmlFor="invite-role">Permission</label><select id="invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as "viewer"|"editor")}><option value="viewer">Viewer — future read-only access</option><option value="editor">Editor — future editing access</option></select><button type="submit" disabled={inviteBusy||!households.some(h=>h.created_by===session.user.id)}>{inviteBusy?"Working…":"Create invitation"}</button></form><p className="account-helper">Invitation emails aren't sent automatically. Share the generated invitation ID privately.</p>
   </div>
   <div className="account-card account-wide"><div className="account-section-heading"><div><span className="account-kicker">INVITATION CENTER</span><h3>Manage invitations</h3><p>Review access requests and revoke pending invitations.</p></div><span className="account-count">{invites.length}</span></div>
    {invites.length?<ul className="account-invite-list">{invites.map(inv=><li key={inv.id}><div className="account-invite-meta"><strong>{inv.invited_email}</strong><span className="account-invite-badge">{inv.revoked_at?"Revoked":inv.accepted_at?"Accepted":new Date(inv.expires_at).getTime()<=Date.now()?"Expired":"Pending"} · {inv.role}</span></div><div className="account-invite-token"><code>{inv.id}</code><button type="button" className="secondary" onClick={()=>void navigator.clipboard?.writeText(inv.id)}>Copy ID</button></div>{!inv.revoked_at&&!inv.accepted_at&&new Date(inv.expires_at).getTime()>Date.now()&&<button type="button" className="secondary" disabled={inviteBusy} onClick={()=>void revokeInvite(inv.id)}>Revoke</button>}</li>)}</ul>:<p className="account-empty">No invitations created yet.</p>}
    <div className="account-accept"><h4>Have an invitation?</h4><p>Sign in with the invited email, then enter the invitation ID.</p><form className="account-inline-form" onSubmit={e=>void acceptInvite(e)}><div><label htmlFor="accept-invite">Invitation ID</label><input id="accept-invite" required value={acceptId} onChange={e=>setAcceptId(e.target.value)} placeholder="Paste invitation ID"/></div><button type="submit" disabled={inviteBusy}>{inviteBusy?"Working…":"Accept invitation"}</button></form></div>{inviteMessage&&<p role="status" className="account-feedback">{inviteMessage}</p>}
   </div>
  </div>}
  <div className="account-privacy-note"><strong>Your inventory stays on this device</strong><p>Household access is ready, but inventory sharing, file uploads, and cloud synchronization aren't enabled. Signing in will not move or replace your local records.</p></div>
 </div>;
}
