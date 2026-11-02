import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=url&&key?createClient(url,key):null;
export function useSharedTaxonomy(){
 const [categories,setCategories]=useState<string[]>([]);
 const [locations,setLocations]=useState<string[]>([]);
 const [household,setHousehold]=useState("");
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const refresh=()=>setRevision(n=>n+1);
  window.addEventListener("housevault:taxonomy-changed",refresh);
  window.addEventListener("focus",refresh);
  return()=>{window.removeEventListener("housevault:taxonomy-changed",refresh);window.removeEventListener("focus",refresh);};
 },[]);
 useEffect(()=>{
  if(!client)return;
  const db=client;let active=true;
  void (async()=>{
   const {data:{session}}=await db.auth.getSession();
   if(!active)return;
   if(!session){setCategories([]);setLocations([]);setHousehold("");return;}
   const {data:members,error}=await db.from("household_members").select("household_id").eq("user_id",session.user.id);
   if(!active||error)return;
   const ids=(members??[]).map(m=>m.household_id as string);
   const selected=localStorage.getItem("housevault.taxonomy-household")??"";
   const id=ids.includes(selected)?selected:(ids[0]??"");
   if(!id){setCategories([]);setLocations([]);setHousehold("");return;}
   const [a,b]=await Promise.all([db.from("household_categories").select("name").eq("household_id",id),db.from("household_locations").select("path").eq("household_id",id)]);
   if(!active||a.error||b.error)return;
   setHousehold(id);
   setCategories((a.data??[]).map(x=>x.name as string));
   setLocations((b.data??[]).map(x=>x.path as string));
  })();
  return()=>{active=false;};
 },[revision]);
 return {categories,locations,household};
}
