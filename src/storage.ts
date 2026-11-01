import { seed, type Item } from "./domain";
const KEY="housevault.inventory.v1";
export function loadItems(): Item[] {
 try { const raw=localStorage.getItem(KEY); if(!raw)return seed; const parsed: unknown=JSON.parse(raw); return Array.isArray(parsed)?parsed as Item[]:seed; } catch { return seed; }
}
export function saveItems(items:Item[]):void { localStorage.setItem(KEY,JSON.stringify(items)); }
