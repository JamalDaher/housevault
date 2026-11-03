import type { Item } from "./domain";

/** Attachment manifests for a future authenticated cloud transport.
 * Binary data is never put in the manifest; uploads must use the digest to
 * verify downloaded bytes before applying inventory changes.
 */
export type AttachmentEntry = { key:string; itemId:string; kind:"cover"|"photo"|"document"; mime:string; bytes:number; sha256:string };
export type AttachmentBlob = { entry:AttachmentEntry; data:string };
const DATA=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/;
function decode(value:string):{mime:string;bytes:Uint8Array}{
 const match=DATA.exec(value);
 if(!match)throw new Error("Invalid attachment data URL");
 const raw=atob(match[2]);
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 return {mime:match[1],bytes};
}
function hex(buffer:ArrayBuffer):string{return Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,"0")).join("");}
async function digest(bytes:Uint8Array):Promise<string>{
 return hex(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes)));
}
export async function buildAttachmentManifest(items:Item[]):Promise<AttachmentBlob[]>{
 const output:AttachmentBlob[]=[];
 const seen=new Set<string>();
 for(const item of items){
  const candidates:{kind:AttachmentEntry["kind"];id:string;data:string}[]=[];
  if(item.photo)candidates.push({kind:"cover",id:"cover",data:item.photo});
  for(const [index,data] of (item.photos??[]).entries())candidates.push({kind:"photo",id:String(index),data});
  for(const document of item.documents??[])candidates.push({kind:"document",id:document.id,data:document.data});
  for(const candidate of candidates){
   const key=[item.id,candidate.kind,candidate.id].map(encodeURIComponent).join("/");
   if(seen.has(key))throw new Error("Duplicate attachment identity");
   seen.add(key);
   const {mime,bytes}=decode(candidate.data);
   output.push({entry:{key,itemId:item.id,kind:candidate.kind,mime,bytes:bytes.length,sha256:await digest(bytes)},data:candidate.data});
  }
 }
 return output;
}
/** Reject corrupt or substituted cloud downloads before handing them to storage. */
export async function verifyAttachment(entry:AttachmentEntry,data:string):Promise<boolean>{
 try{
  const {mime,bytes}=decode(data);
  return mime===entry.mime&&bytes.length===entry.bytes&&await digest(bytes)===entry.sha256;
 }catch{return false;}
}
/** Compare immutable manifests to avoid re-uploading unchanged blobs. */
export function pendingAttachmentUploads(local:AttachmentEntry[],remote:AttachmentEntry[]):AttachmentEntry[]{
 const remoteDigests=new Set(remote.map(e=>e.sha256+":"+e.bytes+":"+e.mime));
 return local.filter(e=>!remoteDigests.has(e.sha256+":"+e.bytes+":"+e.mime));
}
