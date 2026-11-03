import { describe,expect,it } from "vitest";
import type { SyncEntry } from "./syncQueue";
import { revisionQueueTransport } from "./syncRevisionAdapter";
const entry={id:"q1",itemId:"item1",operation:"upsert",payload:{name:"Lamp"},createdAt:0,attempts:0,nextAttemptAt:0,leaseUntil:0,leaseToken:"token"} as SyncEntry;
describe("revision queue adapter",()=>{
 it("passes expected revision and persists successful revision",async()=>{
  const stored:string[]=[];
  const send=revisionQueueTransport(async write=>{expect(write.expectedRevision).toBe("v1");return {status:"saved" as const,revision:"v2",value:write.value};},async()=> "v1",async(_,revision)=>{stored.push(revision)});
  await send(entry);expect(stored).toEqual(["v2"]);
 });
 it("does not persist a revision after a conflict",async()=>{
  const stored:string[]=[];
  const send=revisionQueueTransport(async()=>({status:"conflict" as const,revision:"v3",remote:{name:"Other"}}),async()=> "v1",async(_,revision)=>{stored.push(revision)});
  await expect(send(entry)).rejects.toMatchObject({name:"CloudRevisionConflict"});
  expect(stored).toEqual([]);
 });
 it("rejects deletes before contacting the server",async()=>{
  let called=false;
  const send=revisionQueueTransport(async()=>{called=true;return {status:"saved" as const,revision:"v2",value:{}};},async()=>null,async()=>{});
  await expect(send({...entry,operation:"delete"})).rejects.toThrow("deletion");
  expect(called).toBe(false);
 });
});
