import { describe,it,expect } from "vitest";
import { csvExport,filterItems,totalValue,validItem,seed } from "../src/domain";
describe("inventory domain",()=>{
it("totals quantities correctly",()=>expect(totalValue([{...seed[0],quantity:2,value:100}])).toBe(200));
it("filters by location and category",()=>expect(filterItems(seed,"workshop","Tools")).toHaveLength(1));
it("rejects negative values",()=>expect(validItem({...seed[0],value:-1})).toBe(false));
it("escapes CSV content",()=>expect(csvExport([{...seed[0],name:'a"b'}])).toContain('"a""b"'));
it("handles empty lists",()=>expect(totalValue([])).toBe(0));
});