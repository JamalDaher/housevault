import { seed, type Item } from "./domain";
const LEGACY_KEY="housevault.inventory.v1";
const DB_NAME="housevault";
const STORE="inventory";
const ASSETS="attachments";
const RECORD="items";
const PREFIX="hv-asset:";
function legacyItems():Item[]{
 try{const raw=localStorage.getItem(LEGACY_KEY);if(!raw)return seed;const parsed:unknown=JSON.parse(raw);return Array.isArray(parsed)?parsed as Item[]:seed;}catch{return seed;}
}
function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return;}
  const request=indexedDB.open(DB_NAME,2);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);if(!db.objectStoreNames.contains(ASSETS))db.createObjectStore(ASSETS);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error("Unable to open database"));
  request.onblocked=()=>reject(new Error("Database upgrade blocked; close other HouseVault tabs"));
 });
}
function requestResult<T>(request:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error("Database read failed"));});
}
function assetKey(itemId:string,kind:string,id:string):string{return PREFIX+encodeURIComponent(itemId)+":"+kind+":"+encodeURIComponent(id);}
function extract(items:Item[]):{records:Item[];assets:Map<string,string>}{
 const assets=new Map<string,string>();
 const records=items.map(item=>{
  const copy={...item};
  if(copy.photo?.startsWith("data:")){const key=assetKey(item.id,"cover","legacy");assets.set(key,copy.photo);copy.photo=key;}
  if(copy.photos)copy.photos=copy.photos.map((photo,index)=>{if(!photo.startsWith("data:"))return photo;const key=assetKey(item.id,"photo",String(index));assets.set(key,photo);return key;});
  if(copy.documents)copy.documents=copy.documents.map(doc=>{if(!doc.data.startsWith("data:"))return doc;const key=assetKey(item.id,"document",doc.id);assets.set(key,doc.data);return {...doc,data:key};});
  return copy;
 });
 return {records,assets};
}
async function hydrate(db:IDBDatabase,records:Item[]):Promise<Item[]>{
 const refs=new Set<string>();
 for(const item of records){if(item.photo?.startsWith(PREFIX))refs.add(item.photo);for(const p of item.photos??[])if(p.startsWith(PREFIX))refs.add(p);for(const d of item.documents??[])if(d.data.startsWith(PREFIX))refs.add(d.data);}
 if(!refs.size)return records;
 const tx=db.transaction(ASSETS,"readonly");const store=tx.objectStore(ASSETS);
 const entries=await Promise.all([...refs].map(async key=>[key,await requestResult(store.get(key))] as const));
 const lookup=new Map(entries);
 for(const key of refs)if(typeof lookup.get(key)!=="string")throw new Error("Missing stored attachment: "+key);
 return records.map(item=>({...item,photo:item.photo?.startsWith(PREFIX)?lookup.get(item.photo):item.photo,photos:item.photos?.map(p=>p.startsWith(PREFIX)?lookup.get(p)!:p),documents:item.documents?.map(d=>({...d,data:d.data.startsWith(PREFIX)?lookup.get(d.data)!:d.data}))}));
}
async function read(db:IDBDatabase):Promise<Item[]|undefined>{
 const records=await requestResult(db.transaction(STORE,"readonly").objectStore(STORE).get(RECORD)) as Item[]|undefined;
 if(records===undefined)return undefined;
 if(!Array.isArray(records))throw new Error("Invalid stored inventory");
 return hydrate(db,records);
}
export type AttachmentStorageStats={stored:number;referenced:number;orphaned:number;estimatedBytes:number};
function referencedKeys(records:Item[]):Set<string>{
 const keys=new Set<string>();
 for(const item of records){if(item.photo?.startsWith(PREFIX))keys.add(item.photo);for(const photo of item.photos??[])if(photo.startsWith(PREFIX))keys.add(photo);for(const doc of item.documents??[])if(doc.data.startsWith(PREFIX))keys.add(doc.data);}
 return keys;
}
export async function inspectAttachmentStorage():Promise<AttachmentStorageStats>{
 const db=await openDatabase();
 try{
  const records=await requestResult(db.transaction(STORE,"readonly").objectStore(STORE).get(RECORD)) as Item[]|undefined;
  if(records!==undefined&&!Array.isArray(records))throw new Error("Invalid inventory metadata");
  const referenced=referencedKeys(records??[]);
  const tx=db.transaction(ASSETS,"readonly");const store=tx.objectStore(ASSETS);
  const [keys,values]=await Promise.all([requestResult(store.getAllKeys()),requestResult(store.getAll())]);
  const estimatedBytes=values.reduce<number>((total,value:unknown)=>total+(typeof value==="string"?Math.floor(value.length*3/4):0),0);
  return {stored:keys.length,referenced:referenced.size,orphaned:keys.filter(key=>typeof key==="string"&&!referenced.has(key)).length,estimatedBytes};
 }finally{db.close();}
}
function write(db:IDBDatabase,items:Item[]):Promise<void>{
 const {records,assets}=extract(items);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([STORE,ASSETS],"readwrite");
  const assetStore=tx.objectStore(ASSETS);
  for(const [key,value] of assets){const get=assetStore.get(key);get.onsuccess=()=>{if(get.result!==value)assetStore.put(value,key);};}
  tx.objectStore(STORE).put(records,RECORD);
  // Reclaim only unreferenced attachment keys, in the same atomic transaction as metadata.
  const live=referencedKeys(records);
  const cursorRequest=assetStore.openKeyCursor();
  cursorRequest.onsuccess=()=>{const cursor=cursorRequest.result;if(!cursor)return;if(typeof cursor.key==="string"&&!live.has(cursor.key))assetStore.delete(cursor.key);cursor.continue();};
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??new Error("Unable to save inventory"));
  tx.onabort=()=>reject(tx.error??new Error("Save aborted"));
 });
}
/** First launch migrates legacy localStorage. Existing IndexedDB records are hydrated and
 * migrated to the separate attachment store on the first successful save. */
export async function loadInventory():Promise<Item[]>{
 const db=await openDatabase();
 try{const saved=await read(db);if(saved!==undefined)return saved;const migrated=legacyItems();await write(db,migrated);return migrated;}finally{db.close();}
}
let pending:Promise<void>=Promise.resolve();
export function saveInventory(items:Item[]):Promise<void>{
 const snapshot=structuredClone(items);
 const next=pending.catch(()=>undefined).then(async()=>{const db=await openDatabase();try{await write(db,snapshot);}finally{db.close();}});
 pending=next;return next;
}

/** Add exactly one cloud-imported item atomically with its attachment assets.
 * Never replace existing records or delete existing attachments. */
export function appendImportedItem(item:Item):Promise<void>{
 const snapshot=structuredClone(item);
 const next=pending.catch(()=>undefined).then(async()=>{
  const db=await openDatabase();
  try{
   await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction([STORE,ASSETS],"readwrite");
    const inventory=tx.objectStore(STORE);
    const assets=tx.objectStore(ASSETS);
    const request=inventory.get(RECORD);
    request.onsuccess=()=>{
     const current=request.result as Item[]|undefined;
     if(current!==undefined&&!Array.isArray(current)){tx.abort();return;}
     const records=current??legacyItems();
     if(records.some(existing=>existing.id===snapshot.id)){tx.abort();return;}
     const extracted=extract([snapshot]);
     for(const [key,value] of extracted.assets)assets.put(value,key);
     inventory.put([...records,...extracted.records],RECORD);
    };
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error??new Error("Import transaction failed"));
    tx.onabort=()=>reject(new Error("Import cancelled: record already exists or storage is unavailable."));
   });
  }finally{db.close();}
 });
 pending=next;
 return next;
}
