import { describe,expect,it } from "vitest";
import { seed } from "../src/domain";
import { canEdit,canManageMembers,decideInitialSync,validSyncManifest,compareEquipmentMetadata,cloudAttachmentPaths,countAttachmentReferences,previewRecordConflicts } from "../src/syncFoundation";

describe("cloud sync safety boundary",()=>{
 it("does not overwrite local inventory when cloud is empty",()=>expect(decideInitialSync(seed,[])).toEqual({kind:"upload-local",localCount:seed.length,remoteCount:0}));
 it("does not silently replace empty local inventory",()=>expect(decideInitialSync([],seed)).toEqual({kind:"download-remote",localCount:0,remoteCount:seed.length}));
 it("identifies identical inventories",()=>expect(decideInitialSync(seed,structuredClone(seed)).kind).toBe("identical"));
 it("requires review for conflicting edits",()=>expect(decideInitialSync(seed,[{...seed[0],name:"Renamed"},...seed.slice(1)]).kind).toBe("review-required"));
 it("requires review for records on either side",()=>{const d=decideInitialSync(seed.slice(0,2),seed.slice(1,3));expect(d.kind).toBe("review-required");if(d.kind==="review-required")expect([d.localOnly,d.remoteOnly,d.changed]).toEqual([1,1,0]);});
 it("does not mutate local or remote records",()=>{const a=structuredClone(seed),b=structuredClone(seed);decideInitialSync(a,b);expect(a).toEqual(seed);expect(b).toEqual(seed);});
 it("preserves photo and document data in comparison",()=>{const a=[{...seed[0],photo:"data:image/jpeg;base64,AAAA"}];const b=[{...seed[0],photo:"data:image/jpeg;base64,BBBB"}];expect(decideInitialSync(a,b).kind).toBe("review-required");});
 it("rejects invalid inventory data before any sync decision",()=>expect(()=>decideInitialSync([{...seed[0],quantity:-1}],[])).toThrow());
 it("enforces family role capabilities",()=>{expect(canEdit("owner")).toBe(true);expect(canEdit("editor")).toBe(true);expect(canEdit("viewer")).toBe(false);expect(canManageMembers("owner")).toBe(true);expect(canManageMembers("editor")).toBe(false);expect(canManageMembers("viewer")).toBe(false);});
 it("validates sync revision metadata",()=>{expect(validSyncManifest({schemaVersion:1,workspaceId:"family-1",revision:"rev-1",updatedAt:"2026-11-01T00:00:00Z",itemCount:2})).toBe(true);expect(validSyncManifest({schemaVersion:1,workspaceId:"",revision:"",updatedAt:"oops",itemCount:-1})).toBe(false);});
});

describe("read-only sync audit",()=>{
 it("ignores attachment encoding differences in equipment comparison",()=>{
  const local=[{...seed[0],photo:"data:image/jpeg;base64,AAAA"}];
  const remote=[{...seed[0],photo:"cloud-asset:12345678-1234-1234-1234-123456789abc/12345678-1234-1234-1234-123456789abc"}];
  expect(compareEquipmentMetadata(local,remote).kind).toBe("identical");
  expect(countAttachmentReferences(local)).toBe(1);
 });
 it("counts unique private files separately from references",()=>{
  const household="12345678-1234-1234-1234-123456789abc";
  const path=household+"/12345678-1234-1234-1234-123456789abc";
  const result=cloudAttachmentPaths([{...seed[0],photo:"cloud-asset:"+path,photos:["cloud-asset:"+path]}],household);
  expect(result).toEqual({paths:[path],invalid:0});
 });
 it("flags malformed or foreign household attachment references",()=>{
  const result=cloudAttachmentPaths([{...seed[0],photo:"cloud-asset:foreign/file"}],"12345678-1234-1234-1234-123456789abc");
  expect(result.invalid).toBe(1);
 });
});

describe("jsonb-compatible comparisons",()=>{
 it("ignores object key order at all nesting levels",()=>{
  const a=[{...seed[0],customFields:[{id:"x",label:"Color",value:"Blue"}]}];
  const b=[{customFields:[{value:"Blue",label:"Color",id:"x"}],notes:seed[0].notes,value:seed[0].value,quantity:seed[0].quantity,location:seed[0].location,category:seed[0].category,name:seed[0].name,id:seed[0].id}];
  expect(decideInitialSync(a,b).kind).toBe("identical");
  expect(compareEquipmentMetadata(a,b).kind).toBe("identical");
 });
 it("still identifies real field changes",()=>{
  expect(compareEquipmentMetadata(seed,[{...seed[0],value:seed[0].value+1},...seed.slice(1)]).kind).toBe("review-required");
 });
});

describe("per-record conflict preview",()=>{
 it("shows only changed field names",()=>{
  const result=previewRecordConflicts([seed[0]],[{...seed[0],name:"Updated",value:100}]);
  expect(result).toEqual([{id:seed[0].id,name:seed[0].name,status:"different",fields:["name","value"]}]);
 });
 it("identifies device-only and cloud-only records",()=>{
  const result=previewRecordConflicts([seed[0]],[seed[1]]);
  expect(result.map(x=>x.status)).toEqual(["device-only","cloud-only"]);
 });
 it("ignores private attachment encodings and object order",()=>{
  const a={...seed[0],photo:"data:image/jpeg;base64,AAAA"};
  const b={photo:"cloud-asset:abc",notes:a.notes,value:a.value,quantity:a.quantity,location:a.location,category:a.category,name:a.name,id:a.id};
  expect(previewRecordConflicts([a],[b])).toEqual([]);
 });
});
