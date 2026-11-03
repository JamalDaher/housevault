import {describe,expect,it} from "vitest";
import {buildDeletionReview} from "./cloudDeletionReview";
import type {Item} from "./domain";
const item=(id:string):Item=>({id,name:id,category:"Tools",location:"Shop",quantity:1,value:20,notes:""});
describe("deletion review",()=>{
 it("lists eligible missing items but not locally present records",()=>{
  const a=item("a"),b=item("b");
  const rows=buildDeletionReview([b],[{itemId:"a",revision:"r1",value:a},{itemId:"b",revision:"r1",value:b}],new Map([["a",{revision:"r1",value:a}]]));
  expect(rows).toHaveLength(1);
  expect(rows[0].decision.kind).toBe("eligible");
 });
 it("never marks an untracked record eligible",()=>{
  const a=item("a");
  expect(buildDeletionReview([],[{itemId:"a",revision:"r1",value:a}],new Map())[0].decision.kind).toBe("untracked");
 });
 it("reports changed remote records as conflicts",()=>{
  const a=item("a");
  const rows=buildDeletionReview([],[{itemId:"a",revision:"r2",value:a}],new Map([["a",{revision:"r1",value:a}]]));
  expect(rows[0].decision.kind).toBe("conflict");
 });
 it("rejects duplicate cloud IDs and excludes smoke test rows",()=>{
  const a=item("a");
  const row={itemId:"a",revision:"r1",value:a};
  expect(()=>buildDeletionReview([],[row,row],new Map())).toThrow("Duplicate");
  expect(buildDeletionReview([],[{itemId:"__housevault_test_1",revision:"r1",value:item("__housevault_test_1")}],new Map())).toEqual([]);
 });
});
