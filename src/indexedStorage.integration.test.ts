import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { Item } from "./domain";
import { appendImportedItem, loadInventory, replaceImportedItem, saveInventory, inspectAttachmentStorage } from "./indexedStorage";

const item=(id:string,name:string,photo?:string):Item=>({id,name,category:"Tools",location:"Garage",quantity:1,value:10,notes:"",...(photo?{photo}: {})});
const image=(value:string)=>"data:image/png;base64,"+value;
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("housevault",2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const raw=async()=>{const db=await open();try{return await new Promise<Item[]>((resolve,reject)=>{const r=db.transaction("inventory","readonly").objectStore("inventory").get("items");r.onsuccess=()=>resolve(r.result as Item[]);r.onerror=()=>reject(r.error);});}finally{db.close();}};
beforeEach(()=>{Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});Object.defineProperty(globalThis,"window",{configurable:true,value:globalThis});Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>null}});});

describe("real IndexedDB transaction integrity",()=>{
 it("rolls back an aborted duplicate import without changing records or attachments",async()=>{
  await saveInventory([item("a","Original",image("YQ=="))]);
  const before=await raw(),stats=await inspectAttachmentStorage();
  await expect(appendImportedItem(item("a","Duplicate",image("Yg==")))).rejects.toThrow();
  expect(await raw()).toEqual(before);
  expect(await inspectAttachmentStorage()).toEqual(stats);
  expect((await loadInventory())[0].photo).toBe(image("YQ=="));
 });
 it("rejects stale replacement after another writer changes the record",async()=>{
  const original=item("a","Original",image("YQ=="));
  await saveInventory([original]);
  // Simulate another tab writing before the guarded replacement.
  await saveInventory([item("a","Other tab",image("Yg=="))]);
  await expect(replaceImportedItem(item("a","Cloud",image("Yw==")),original)).rejects.toThrow();
  expect((await loadInventory())[0].name).toBe("Other tab");
 });
 it("preserves previous attachment bytes on cloud replacement",async()=>{
  const original=item("a","Original",image("YQ=="));
  await saveInventory([original]);
  await replaceImportedItem(item("a","Cloud",image("Yg==")),original);
  expect((await loadInventory())[0].photo).toBe(image("Yg=="));
  const db=await open();
  try{
   const values=await new Promise<string[]>((resolve,reject)=>{const r=db.transaction("attachments","readonly").objectStore("attachments").getAll();r.onsuccess=()=>resolve(r.result as string[]);r.onerror=()=>reject(r.error);});
   expect(values).toContain(image("YQ=="));
   expect(values).toContain(image("Yg=="));
  }finally{db.close();}
 });
});
