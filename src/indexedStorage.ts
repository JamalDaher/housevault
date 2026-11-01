import { seed, type Item } from "./domain";
const LEGACY_KEY="housevault.inventory.v1";
const DB_NAME="housevault";
const STORE="inventory";
const RECORD="items";
function legacyItems():Item[] {
 try{const raw=localStorage.getItem(LEGACY_KEY);if(!raw)return seed;const parsed:unknown=JSON.parse(raw);return Array.isArray(parsed)?parsed as Item[]:seed;}catch{return seed;}
}
function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window)){reject(new Error("IndexedDB unavailable"));return;}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error("Unable to open database"));
  request.onblocked=()=>reject(new Error("Database upgrade blocked"));
 });
}
function read(db:IDBDatabase):Promise<Item[]|undefined>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly");const request=tx.objectStore(STORE).get(RECORD);
  request.onsuccess=()=>resolve(request.result as Item[]|undefined);
  request.onerror=()=>reject(request.error??new Error("Unable to read inventory"));
 });
}
function write(db:IDBDatabase,items:Item[]):Promise<void>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(items,RECORD);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??new Error("Unable to save inventory"));
  tx.onabort=()=>reject(tx.error??new Error("Save aborted"));
 });
}
/** First launch migrates legacy localStorage without deleting the original copy. */
export async function loadInventory():Promise<Item[]>{
 const db=await openDatabase();
 try{
  const saved=await read(db);
  if(saved!==undefined){if(!Array.isArray(saved))throw new Error("Invalid stored inventory");return saved;}
  const migrated=legacyItems();
  await write(db,migrated);
  return migrated;
 }finally{db.close();}
}
export async function saveInventory(items:Item[]):Promise<void>{
 const db=await openDatabase();
 try{await write(db,items);}finally{db.close();}
}
