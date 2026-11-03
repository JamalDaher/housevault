import {describe,it,expect} from "vitest";
import {planHouseholdOutbox} from "./householdOutboxPlan";
import type {Item} from "./domain";
const item:Item={id:"a",name:"Hammer",category:"Tools",location:"Shop",quantity:1,value:10,notes:""};
const baselines=new Map([["a",{revision:"r1",value:item}]]);
const plan=(previous:Item[],current:Item[],allowCreates=false,allowDeletes=false,known=baselines)=>planHouseholdOutbox({householdId:"home",previous,current,baselines:known,allowCreates,allowDeletes});
describe("household outbox eligibility",()=>{
 it("requires a selected household",()=>{
  expect(()=>planHouseholdOutbox({householdId:"",previous:[],current:[item],baselines,allowCreates:true,allowDeletes:true})).toThrow();
 });
 it("allows trusted edits but not unapproved new uploads",()=>{
  expect(plan([item],[{...item,name:"New"}])).toHaveLength(1);
  expect(plan([],[item],false,false,new Map())).toHaveLength(0);
  expect(plan([],[item],true,false,new Map())).toHaveLength(1);
 });
 it("never queues deletion without opt-in and a known baseline",()=>{
  expect(plan([item],[])).toHaveLength(0);
  expect(plan([item],[],false,true)).toHaveLength(1);
  expect(plan([item],[],false,true,new Map())).toHaveLength(0);
 });
});
