import { describe,it,expect } from "vitest";
import { csvExport,exportBackup,parseBackup,filterItems,totalValue,validItem,seed,locationPaths,normalizeLocation,locationTree,itemsAtLocation,warrantyStatus } from "../src/domain";
describe("inventory domain",()=>{
it("totals quantities correctly",()=>expect(totalValue([{...seed[0],quantity:2,value:100}])).toBe(200));
it("filters by location and category",()=>expect(filterItems(seed,"workshop","Tools")).toHaveLength(1));
it("rejects negative values",()=>expect(validItem({...seed[0],value:-1})).toBe(false));
it("escapes CSV content",()=>expect(csvExport([{...seed[0],name:'a"b'}])).toContain('"a""b"'));
it("normalizes hierarchical location paths",()=>expect(normalizeLocation(" House / Garage / Shelf 2 ")).toBe("House / Garage / Shelf 2"));
it("deduplicates locations",()=>expect(locationPaths([{...seed[0],location:"Garage"},{...seed[1],location:"Garage"}])).toEqual(["Garage"]));
it("includes ancestor locations",()=>expect(locationTree([{...seed[0],location:"House / Garage / Shelf"}])).toEqual(["House","House / Garage","House / Garage / Shelf"]));
it("matches exact location and descendants only",()=>expect(itemsAtLocation([{...seed[0],location:"House / Garage"},{...seed[1],location:"House / Garage / Shelf"},{...seed[2],location:"House / Garage Annex"}],"House / Garage")).toHaveLength(2));
it("round-trips a JSON backup",()=>expect(parseBackup(exportBackup(seed))).toEqual(seed));
it("rejects malformed backup",()=>expect(()=>parseBackup('{"items":[]}')).toThrow());
it("rejects duplicate item IDs",()=>expect(()=>parseBackup(exportBackup([seed[0],seed[0]]))).toThrow());
it("classifies warranty dates",()=>{const today="2026-11-01";expect(warrantyStatus(seed[0],today)).toBe("unknown");expect(warrantyStatus({...seed[0],warrantyEnd:"2026-10-31"},today)).toBe("expired");expect(warrantyStatus({...seed[0],warrantyEnd:"2026-11-30"},today)).toBe("expiring");expect(warrantyStatus({...seed[0],warrantyEnd:"2026-12-02"},today)).toBe("active");});
it("handles empty lists",()=>expect(totalValue([])).toBe(0));
});