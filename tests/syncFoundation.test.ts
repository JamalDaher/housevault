import { describe,expect,it } from "vitest";
import { seed } from "../src/domain";
import { canEdit,canManageMembers,decideInitialSync,validSyncManifest } from "../src/syncFoundation";

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
