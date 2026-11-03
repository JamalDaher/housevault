import {describe,it,expect} from "vitest";
import {planPendingChange} from "./offlineReconciliation";
import type {Item} from "./domain";
const item:Item={id:"a",name:"Hammer",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const baseline={revision:"r1",value:item};
const remote={revision:"r1",value:item};
describe("offline reconciliation safety",()=>{
 it("creates only never-synced records",()=>{
  expect(planPendingChange({itemId:"a",local:item,baseline:null,remote:null}).kind).toBe("create");
  expect(planPendingChange({itemId:"a",local:item,baseline:null,remote}).kind).toBe("conflict");
 });
 it("updates changed local items only against unchanged cloud baseline",()=>{
  const changed={...item,name:"New hammer"};
  expect(planPendingChange({itemId:"a",local:changed,baseline,remote}).kind).toBe("update");
  expect(planPendingChange({itemId:"a",local:changed,baseline,remote:{...remote,revision:"r2"}}).kind).toBe("conflict");
 });
 it("never infers deletion without trusted baseline",()=>{
  expect(planPendingChange({itemId:"a",local:null,baseline:null,remote}).kind).toBe("unchanged");
  expect(planPendingChange({itemId:"a",local:null,baseline,remote}).kind).toBe("delete");
  expect(planPendingChange({itemId:"a",local:null,baseline,remote:null}).kind).toBe("conflict");
 });
 it("rejects attachments and mismatched identities",()=>{
  expect(planPendingChange({itemId:"a",local:{...item,photo:"data:image/png;base64,abc"},baseline,remote}).kind).toBe("conflict");
  expect(planPendingChange({itemId:"b",local:item,baseline,remote}).kind).toBe("conflict");
 });
 it("does not recreate tombstoned cloud items",()=>{
  expect(planPendingChange({itemId:"a",local:item,baseline:null,remote:{...remote,deleted:true}}).kind).toBe("conflict");
  expect(planPendingChange({itemId:"a",local:null,baseline,remote:{...remote,deleted:true}}).kind).toBe("conflict");
 });
 it("leaves unchanged records alone",()=>{
  expect(planPendingChange({itemId:"a",local:item,baseline,remote}).kind).toBe("unchanged");
 });
});
