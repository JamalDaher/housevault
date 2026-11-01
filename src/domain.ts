export type Category = "Tools" | "Electronics" | "Appliances" | "Outdoor" | "Other";
export type Item = { id: string; name: string; category: Category; location: string; quantity: number; value: number; notes: string; brand?: string; model?: string; serialNumber?: string; purchaseDate?: string; warrantyEnd?: string; maintenanceTask?: string; lastService?: string; serviceIntervalDays?: number; };
export const categories: Category[] = ["Tools","Electronics","Appliances","Outdoor","Other"];
export const seed: Item[] = [
{id:"demo-1",name:"Portable Generator",category:"Tools",location:"Detached Garage",quantity:1,value:950,notes:"Demo record"},
{id:"demo-2",name:"Cordless Drill",category:"Tools",location:"Workshop",quantity:1,value:140,notes:"Demo record"},
{id:"demo-3",name:"Television",category:"Electronics",location:"Living Room",quantity:1,value:450,notes:"Demo record"},
{id:"demo-4",name:"Refrigerator",category:"Appliances",location:"Kitchen",quantity:1,value:1100,notes:"Demo record"},
{id:"demo-5",name:"Fishing Rod",category:"Outdoor",location:"Garage",quantity:3,value:85,notes:"Demo record"}];
export function totalValue(items: Item[]): number { return items.reduce((sum,item)=>sum+item.value*item.quantity,0); }
export function filterItems(items: Item[], query: string, category: string): Item[] {
 const q=query.trim().toLowerCase(); return items.filter(item=>(category==="All"||item.category===category)&&[item.name,item.location,item.notes].some(s=>s.toLowerCase().includes(q)));
}
export function validItem(item: Item): boolean { return Boolean(item.name.trim()&&item.location.trim()&&Number.isFinite(item.value)&&item.value>=0&&Number.isInteger(item.quantity)&&item.quantity>0); }
export function csvExport(items: Item[]): string {
 const escape=(v:string|number)=>'"'+String(v).replaceAll('"','""')+'"';
 return [["Name","Category","Location","Quantity","Unit Value","Notes"],...items.map(i=>[i.name,i.category,i.location,i.quantity,i.value,i.notes])].map(row=>row.map(escape).join(",")).join("\r\n");
}

/** Distinct location paths sorted for consistent filtering and autocomplete. */
export function locationPaths(items: Item[]): string[] { return [...new Set(items.map(i=>i.location.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
export function normalizeLocation(path: string): string { return path.split("/").map(part=>part.trim()).filter(Boolean).join(" / "); }

/** Includes every ancestor so a room can be browsed even if no item is stored directly in it. */
export function locationTree(items: Item[]): string[] {
 const paths=new Set<string>();
 for(const item of items){const segments=normalizeLocation(item.location).split(" / ").filter(Boolean);for(let i=1;i<=segments.length;i++)paths.add(segments.slice(0,i).join(" / "));}
 return [...paths].sort((a,b)=>a.localeCompare(b));
}
export function itemsAtLocation(items: Item[], location: string): Item[] {
 const prefix=normalizeLocation(location);return prefix?items.filter(i=>{const path=normalizeLocation(i.location);return path===prefix||path.startsWith(prefix+" / ");}):items;
}

export function exportBackup(items: Item[]): string {
 return JSON.stringify({format:"housevault-backup",version:1,exportedAt:new Date().toISOString(),items},null,2);
}
export function parseBackup(raw: string): Item[] {
 const data: unknown=JSON.parse(raw);
 if(!data||typeof data!=="object")throw new Error("Invalid backup file.");
 const backup=data as Record<string,unknown>;
 if(backup.format!=="housevault-backup"||backup.version!==1||!Array.isArray(backup.items))throw new Error("Unsupported HouseVault backup format.");
 if(backup.items.length>10000)throw new Error("Backup contains too many items.");
 const ids=new Set<string>();
 return backup.items.map((entry:unknown)=>{
  if(!entry||typeof entry!=="object")throw new Error("Invalid inventory item.");
  const i=entry as Record<string,unknown>;
  if(typeof i.id!=="string"||!i.id.trim()||ids.has(i.id)||typeof i.name!=="string"||typeof i.location!=="string"||typeof i.notes!=="string"||typeof i.category!=="string"||!categories.includes(i.category as Category)||typeof i.quantity!=="number"||typeof i.value!=="number")throw new Error("Backup contains invalid or duplicate records.");
  for(const field of ["brand","model","serialNumber","purchaseDate","warrantyEnd","maintenanceTask","lastService"])if(i[field]!==undefined&&typeof i[field]!=="string")throw new Error("Invalid optional item field.");
  if(i.serviceIntervalDays!==undefined&&(!Number.isInteger(i.serviceIntervalDays)||Number(i.serviceIntervalDays)<1))throw new Error("Invalid maintenance interval.");
  const item=i as unknown as Item;
  if(!validItem(item))throw new Error("Backup contains invalid inventory values.");
  ids.add(item.id);return item;
 });
}

export type WarrantyStatus = "unknown" | "active" | "expiring" | "expired";
export function warrantyStatus(item: Item, today = new Date().toISOString().slice(0,10)): WarrantyStatus {
 const end=item.warrantyEnd;
 if(!end||!/^(\d{4})-(\d{2})-(\d{2})$/.test(end)||Number.isNaN(Date.parse(end))||new Date(end).toISOString().slice(0,10)!==end)return "unknown";
 if(end<today)return "expired";
 const days=Math.round((Date.parse(end+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
 return days<=30?"expiring":"active";
}

export type MaintenanceStatus = "unscheduled" | "upcoming" | "due" | "overdue";
export function nextServiceDate(item: Item): string | null {
 if(!item.lastService||!/^\d{4}-\d{2}-\d{2}$/.test(item.lastService)||!Number.isInteger(item.serviceIntervalDays)||!(item.serviceIntervalDays!>0))return null;
 const start=new Date(item.lastService+"T00:00:00Z");
 if(Number.isNaN(start.getTime())||start.toISOString().slice(0,10)!==item.lastService)return null;
 start.setUTCDate(start.getUTCDate()+item.serviceIntervalDays!);
 return start.toISOString().slice(0,10);
}
export function maintenanceStatus(item: Item,today=new Date().toISOString().slice(0,10)): MaintenanceStatus {
 const due=nextServiceDate(item);if(!due)return "unscheduled";
 if(due<today)return "overdue";
 const days=Math.round((Date.parse(due+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
 return days===0?"due":days<=30?"upcoming":"unscheduled";
}
