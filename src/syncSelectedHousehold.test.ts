import "fake-indexeddb/auto";
import {IDBFactory} from "fake-indexeddb";
import {beforeEach,describe,expect,it} from "vitest";
import type {Item} from "./domain";
import type {CloudRevisionClient,CloudRevisionRow} from "./cloudRevisionApi";
import {saveInventory} from "./indexedStorage";
import {saveSyncBaseline,readSyncBaseline} from "./syncBaselines";
import {enqueueSync,listPendingSync} from "./syncQueue";
import {syncSelectedHousehold} from "./syncSelectedHousehold";

const item:Item={id:"test-adapter",name:"Old name",category:"Tools",location:"Shop",quantity:1,value:5,notes:""};
beforeEach(()=>{Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:new IDBFactory()});Object.defineProperty(globalThis,"window",{configurable:true,value:globalThis});Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>null}});});
function client(remote:CloudRevisionRow<Item>,calls:{writes:number;expected:(string|null)[]}):CloudRevisionClient<Item>{
 return {
  from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:remote,error:null})})})})}),
  rpc:async(_name,args)=>{
   calls.writes++;
   calls.expected.push(args.p_expected);
   if(args.p_expected!==remote.revision)return {data:null,error:{code:"HV001",message:"Revision mismatch"}};
   return {data:"r2",error:null};
  }
 };
}
describe("selected household adapter integration",()=>{
 it("loads local inventory and baseline, sends expected cloud revision, then acknowledges",async()=>{
  const edited={...item,name:"Updated name"};
  await saveInventory([edited]);
  await saveSyncBaseline("home",item.id,{revision:"r1",value:item});
  await enqueueSync(item.id,"upsert",edited,100,"home");
  const calls={writes:0,expected:[] as (string|null)[]};
  const remote={item_id:item.id,payload:item,revision:"r1"};
  const result=await syncSelectedHousehold(client(remote,calls),"home",{now:()=>100});
  expect(result).toEqual({sent:1,failed:0,remaining:false,stopped:"empty"});
  expect(calls).toEqual({writes:1,expected:["r1"]});
  expect(await readSyncBaseline("home",item.id)).toEqual({revision:"r2",value:edited});
  expect(await listPendingSync()).toEqual([]);
 });
 it("retains a queued edit if the cloud revision differs from the baseline",async()=>{
  const edited={...item,name:"Updated name"};
  await saveInventory([edited]);
  await saveSyncBaseline("home",item.id,{revision:"r1",value:item});
  await enqueueSync(item.id,"upsert",edited,100,"home");
  const calls={writes:0,expected:[] as (string|null)[]};
  const remote={item_id:item.id,payload:{...item,name:"Someone else's edit"},revision:"r3"};
  const result=await syncSelectedHousehold(client(remote,calls),"home",{now:()=>100});
  expect(result.stopped).toBe("conflict");
  expect(calls.writes).toBe(0);
  expect((await listPendingSync())).toHaveLength(1);
  expect(await readSyncBaseline("home",item.id)).toEqual({revision:"r1",value:item});
 });
});
