import type { AttachmentBlob, AttachmentEntry } from "./attachmentSync";
import { verifyAttachment } from "./attachmentSync";

/** An authenticated transport must scope all paths to the active household.
 * This adapter validates data but does not grant storage permissions.
 */
export type AttachmentStorage={
 upload:(path:string,data:string,mime:string)=>Promise<void>;
 download:(path:string)=>Promise<string>;
};
const SAFE_DIGEST=/^[0-9a-f]{64}$/;
export function attachmentStoragePath(householdId:string,entry:AttachmentEntry):string{
 if(!/^[0-9a-f-]{36}$/i.test(householdId))throw new Error("Invalid household ID");
 if(!SAFE_DIGEST.test(entry.sha256))throw new Error("Invalid attachment digest");
 if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(entry.mime))throw new Error("Unsupported attachment type");
 return householdId+"/"+entry.sha256;
}
export async function uploadVerifiedAttachment(storage:AttachmentStorage,householdId:string,blob:AttachmentBlob):Promise<string>{
 if(!await verifyAttachment(blob.entry,blob.data))throw new Error("Attachment integrity check failed");
 const path=attachmentStoragePath(householdId,blob.entry);
 await storage.upload(path,blob.data,blob.entry.mime);
 return path;
}
export async function downloadVerifiedAttachment(storage:AttachmentStorage,householdId:string,entry:AttachmentEntry):Promise<string>{
 const path=attachmentStoragePath(householdId,entry);
 const data=await storage.download(path);
 if(!await verifyAttachment(entry,data))throw new Error("Cloud attachment integrity check failed");
 return data;
}
