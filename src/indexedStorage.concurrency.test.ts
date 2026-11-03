import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { Item } from "./domain";
import { appendImportedItem, inspectAttachmentStorage, loadInventory, replaceImportedItem, saveInventory } from "./indexedStorage";

const photo=(data:string)=>"data:image/png;base64,"+data;
const item=(id:string,name:string,cover?:string):Item=>({id,name,category:"Tools",location:"Garage",quantity:1,value:10,notes:"",...(cover?{photo:cover}:{})});
function connect():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{const request=indexedDB.open("housevault",2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
function finished(tx:IDBTransaction):Promise<void>{
 return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error("Aborted"));tx.onerror=()=>reject(tx.error??new Error("Failed"));});
}
function get<T>(store:IDBObjectStore,key:string):Promise<T>{
 return new Promise((resolve,reject)=>{const request=store.get(key);request.onsuccess=()=>resolve(request.result as T);request.onerror=()=>reject(request.error);});
}
beforeEach(()=>{
 Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});
 Object.defineProperty(globalThis,"window",{configurable:true,value:globalThis});
 Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>null}});
});

describe("multi-connection IndexedDB safety and recovery",()=>{
 it("serializes overlapping readwrite transactions from two independent connections",async()=>{
  await saveInventory([item("base","Existing")]);
  const first=await connect(),second=await connect();
  try{
   const tx1=first.transaction(["inventory","attachments"],"readwrite");
   const done1=finished(tx1);
   const firstRead=await get<Item[]>(tx1.objectStore("inventory"),"items");
   tx1.objectStore("inventory").put([...firstRead,item("first","First tab")],"items");
   const tx2=second.transaction(["inventory","attachments"],"readwrite");
   const done2=finished(tx2);
   const request=tx2.objectStore("inventory").get("items");
   request.onsuccess=()=>{
    const latest=request.result as Item[];
    tx2.objectStore("inventory").put([...latest,item("second","Second tab")],"items");
   };
   await Promise.all([done1,done2]);
   expect((await loadInventory()).map(i=>i.id)).toEqual(["base","first","second"]);
  }finally{first.close();second.close();}
 });
 it("rolls back both metadata and new asset when a write transaction aborts",async()=>{
  await saveInventory([item("base","Existing",photo("YQ=="))]);
  const before=await loadInventory(),stats=await inspectAttachmentStorage();
  const db=await connect();
  try{
   const tx=db.transaction(["inventory","attachments"],"readwrite");
   const done=finished(tx);
   tx.objectStore("attachments").put(photo("Yg=="),"hv-asset:failure:cover:legacy");
   tx.objectStore("inventory").put([item("corrupt","Partial")],"items");
   tx.abort(); // Inject a failure before commit, after queuing both writes.
   await expect(done).rejects.toThrow();
  }finally{db.close();}
  expect(await loadInventory()).toEqual(before);
  expect(await inspectAttachmentStorage()).toEqual(stats);
 });
 it("recovers after an aborted transaction and permits a subsequent valid import",async()=>{
  await saveInventory([item("base","Existing",photo("YQ=="))]);
  const db=await connect();
  try{
   const tx=db.transaction(["inventory","attachments"],"readwrite");
   const done=finished(tx);
   tx.objectStore("attachments").put(photo("Yg=="),"hv-asset:failed:cover:legacy");
   tx.abort();
   await expect(done).rejects.toThrow();
  }finally{db.close();}
  await appendImportedItem(item("new","Recovered",photo("Yw==")));
  expect((await loadInventory()).map(i=>i.name)).toEqual(["Existing","Recovered"]);
  const stats=await inspectAttachmentStorage();
  expect(stats.orphaned).toBe(0);
  expect(stats.stored).toBe(2);
 });
 it("rejects stale cloud replacement after a separate connection commits an edit",async()=>{
  const original=item("base","Original",photo("YQ=="));
  await saveInventory([original]);
  const otherTab=await connect();
  try{
   const tx=otherTab.transaction("inventory","readwrite");
   const done=finished(tx);
   const request=tx.objectStore("inventory").get("items");
   request.onsuccess=()=>{
    const records=request.result as Item[];
    tx.objectStore("inventory").put(records.map(i=>({...i,name:"Edited elsewhere"})),"items");
   };
   await done;
  }finally{otherTab.close();}
  await expect(replaceImportedItem(item("base","Cloud",photo("Yg==")),original)).rejects.toThrow();
  expect((await loadInventory())[0].name).toBe("Edited elsewhere");
  expect((await loadInventory())[0].photo).toBe(photo("YQ=="));
 });
});
