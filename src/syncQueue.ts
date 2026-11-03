/** Offline-first outbox. No network requests are made by this module. */
export type SyncOperation = "upsert" | "delete";
export type SyncEntry = { id:string; itemId:string; householdId?:string; operation:SyncOperation; payload:unknown; createdAt:number; attempts:number; nextAttemptAt:number; leaseUntil:number; leaseToken:string|null };
const DB="housevault-sync-outbox", STORE="pending", VERSION=1;
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(DB,VERSION);
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:"id"});};
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error??new Error("Unable to open sync queue"));
 request.onblocked=()=>reject(new Error("Sync queue upgrade blocked by another tab"));
});
async function transact<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason:Error)=>void)=>void):Promise<T>{
 const db=await open();
 try{return await new Promise<T>((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);
  let result:T,hasResult=false,settled=false;
  const accept=(value:T)=>{result=value;hasResult=true;};
  const fail=(error:Error)=>{if(!settled){settled=true;try{tx.abort();}catch{/* transaction already ended */}reject(error);}};
  tx.oncomplete=()=>{if(!settled){settled=true;if(hasResult)resolve(result);else reject(new Error("Sync queue transaction had no result"));}};
  tx.onabort=()=>{if(!settled){settled=true;reject(tx.error??new Error("Sync queue transaction aborted"));}};
  tx.onerror=()=>{if(!settled){settled=true;reject(tx.error??new Error("Sync queue transaction failed"));}};
  try{work(tx.objectStore(STORE),accept,fail);}catch(error){fail(error instanceof Error?error:new Error(String(error)));}
 });}finally{db.close();}
}
const snapshot=<T>(value:T):T=>structuredClone(value);
export async function enqueueSync(itemId:string,operation:SyncOperation,payload:unknown,now=Date.now(),householdId?:string):Promise<SyncEntry>{
 if(!itemId.trim())throw new Error("Sync item ID required");
 if(householdId!==undefined&&!householdId.trim())throw new Error("Sync household ID required");
 const entry:SyncEntry={id:crypto.randomUUID(),itemId,householdId,operation,payload:snapshot(payload),createdAt:now,attempts:0,nextAttemptAt:now,leaseUntil:0,leaseToken:null};
 return transact("readwrite",(store,resolve)=>{store.add(entry);resolve(snapshot(entry));});
}
export async function listPendingSync():Promise<SyncEntry[]>{
 return transact("readonly",(store,resolve,reject)=>{const req=store.getAll();req.onsuccess=()=>resolve((req.result as SyncEntry[]).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)));req.onerror=()=>reject(req.error??new Error("Unable to list sync queue"));});
}
/** Claims a single ready entry atomically across tabs; caller must retain the token. */
export async function claimNextSync(now=Date.now(),leaseMs=30_000,householdId?:string):Promise<SyncEntry|null>{
 if(!Number.isFinite(leaseMs)||leaseMs<=0)throw new Error("Invalid lease");
 if(householdId!==undefined&&!householdId.trim())throw new Error("Sync household ID required");
 return transact("readwrite",(store,resolve,reject)=>{
  const req=store.getAll();
  req.onerror=()=>reject(req.error??new Error("Unable to read sync queue"));
  req.onsuccess=()=>{
   const ready=(req.result as SyncEntry[]).filter(e=>e.nextAttemptAt<=now&&e.leaseUntil<=now&&(householdId===undefined||e.householdId===householdId)).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))[0];
   if(!ready){resolve(null);return;}
   const claimed={...ready,leaseUntil:now+leaseMs,leaseToken:crypto.randomUUID()};
   store.put(claimed);resolve(snapshot(claimed));
  };
 });
}
/** Only the current lease holder may acknowledge successful remote persistence. */
export async function acknowledgeSync(id:string,token:string):Promise<boolean>{
 return transact("readwrite",(store,resolve,reject)=>{
  const req=store.get(id);
  req.onerror=()=>reject(req.error??new Error("Unable to acknowledge sync"));
  req.onsuccess=()=>{const current=req.result as SyncEntry|undefined;if(!current||!token||current.leaseToken!==token){resolve(false);return;}store.delete(id);resolve(true);};
 });
}
/** Retry with capped exponential backoff; expired leases can be reclaimed after a crash. */
export async function retrySync(id:string,token:string,now=Date.now()):Promise<boolean>{
 return transact("readwrite",(store,resolve,reject)=>{
  const req=store.get(id);
  req.onerror=()=>reject(req.error??new Error("Unable to retry sync"));
  req.onsuccess=()=>{
   const current=req.result as SyncEntry|undefined;
   if(!current||!token||current.leaseToken!==token){resolve(false);return;}
   const attempts=current.attempts+1;
   const delay=Math.min(300_000,1000*2**Math.min(attempts-1,18));
   store.put({...current,attempts,nextAttemptAt:now+delay,leaseUntil:0,leaseToken:null});
   resolve(true);
  };
 });
}
