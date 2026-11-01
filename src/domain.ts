export type Category = "Tools" | "Electronics" | "Appliances" | "Outdoor" | "Other";
export type ServiceRecord = { id:string; date:string; task:string; notes:string; cost:number }; 
export type Item = { id: string; name: string; category: Category; location: string; quantity: number; value: number; notes: string; brand?: string; model?: string; serialNumber?: string; purchaseDate?: string; warrantyEnd?: string; maintenanceTask?: string; lastService?: string; serviceIntervalDays?: number; serviceHistory?: ServiceRecord[]; };
export const categories: Category[] = ["Tools","Electronics","Appliances","Outdoor","Other"];
export const seed: Item[] = [
{id:"demo-1",name:"Portable Generator",category:"Tools",location:"Detached Garage",quantity:1,value:950,notes:"Demo record"},
{id:"demo-2",name:"Cordless Drill",category:"Tools",location:"Workshop",quantity:1,value:140,notes:"Demo record"},
{id:"demo-3",name:"Television",category:"Electronics",location:"Living Room",quantity:1,value:450,notes:"Demo record"},
{id:"demo-4",name:"Refrigerator",category:"Appliances",location:"Kitchen",quantity:1,value:1100,notes:"Demo record"},
{id:"demo-5",name:"Fishing Rod",category:"Outdoor",location:"Garage",quantity:3,value:85,notes:"Demo record"}];
export function totalValue(items: Item[]): number { return items.reduce((sum,item)=>sum+item.value*item.quantity,0); }
export function filterItems(items: Item[], query: string, category: string): Item[] {
 const q=query.trim().toLowerCase(); return items.filter(item=>(category==="All"||item.category===category)&&[item.name,item.location,item.notes,item.brand,item.model,item.serialNumber,item.maintenanceTask].some(s=>(s??"").toLowerCase().includes(q)));
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
  if(i.serviceHistory!==undefined){if(!Array.isArray(i.serviceHistory)||i.serviceHistory.length>1000)throw new Error("Invalid service history.");for(const record of i.serviceHistory){if(!record||typeof record!=="object"||typeof record.id!=="string"||typeof record.date!=="string"||typeof record.task!=="string"||typeof record.notes!=="string"||typeof record.cost!=="number"||!Number.isFinite(record.cost)||record.cost<0||!validDate(record.date))throw new Error("Invalid service record.");}}
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
 if(!item.lastService||!/^\d{4}-\d{2}-\d{2}$/.test(item.lastService)||!Number.isInteger(item.serviceIntervalDays)||!(typeof item.serviceIntervalDays==="number"&&item.serviceIntervalDays>0))return null;
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

export function validDate(value:string):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const time=Date.parse(value+"T00:00:00Z");return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function recordService(item:Item,record:ServiceRecord):Item {
 if(!validDate(record.date)||!record.task.trim()||!Number.isFinite(record.cost)||record.cost<0)throw new Error("Invalid service record.");
 const history=[...(item.serviceHistory??[]),record].sort((a,b)=>b.date.localeCompare(a.date));
 const latest=[item.lastService??"",record.date].sort().at(-1)!;
 return {...item,serviceHistory:history,lastService:latest};
}

export function maintenanceQueue(items:Item[],today=new Date().toISOString().slice(0,10)):Item[] {
 const rank={overdue:0,due:1,upcoming:2,unscheduled:3};
 return items.filter(i=>maintenanceStatus(i,today)!=="unscheduled").sort((a,b)=>rank[maintenanceStatus(a,today)]-rank[maintenanceStatus(b,today)]||(nextServiceDate(a)??"").localeCompare(nextServiceDate(b)??"")||a.name.localeCompare(b.name));
}

export type InventorySort = "name" | "value-high" | "value-low" | "quantity-high" | "warranty-soon";
export function sortInventory(items:Item[],sort:InventorySort):Item[] {
 const result=[...items];const byName=(a:Item,b:Item)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
 return result.sort((a,b)=>{
  if(sort==="value-high")return b.value*b.quantity-a.value*a.quantity||byName(a,b);
  if(sort==="value-low")return a.value*a.quantity-b.value*b.quantity||byName(a,b);
  if(sort==="quantity-high")return b.quantity-a.quantity||byName(a,b);
  if(sort==="warranty-soon")return (a.warrantyEnd||"9999-12-31").localeCompare(b.warrantyEnd||"9999-12-31")||byName(a,b);
  return byName(a,b);
 });
}

export function parseInventoryCSV(raw:string):Omit<Item,"id">[] {
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 const source=raw.replace(/^\uFEFF/,"");
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"'){if(cell)throw new Error("Malformed CSV quoting.");quoted=true;}else if(c===","){row.push(cell);cell="";}else if(c==="\n"||c==="\r"){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
 if(quoted)throw new Error("Unclosed CSV quote.");row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(!rows.length)throw new Error("CSV is empty.");
 const header=rows.shift()!.map(x=>x.trim().toLowerCase());
 const required=["name","category","location","quantity","unit value","notes"];
 if(header.length!==required.length||required.some((v,i)=>header[i]!==v))throw new Error("CSV headers must be Name, Category, Location, Quantity, Unit Value, Notes.");
 if(rows.length>10000)throw new Error("CSV contains too many items.");
 return rows.map((r,index)=>{if(r.length!==6)throw new Error(`Row ${index+2} has the wrong number of columns.`);
 const [name,category,location,quantity,value,notes]=r;
 const item={name:name.trim(),category:category.trim() as Category,location:normalizeLocation(location),quantity:Number(quantity),value:Number(value),notes};
 if(!categories.includes(item.category)||!quantity.trim()||!value.trim()||!validItem({...item,id:"csv-preview"}))throw new Error(`Invalid inventory data on row ${index+2}.`);
 return item;});
}
export function inventoryDuplicateKey(item:Pick<Item,"name"|"category"|"location">):string {
 return [item.name.trim().toLowerCase(),item.category.toLowerCase(),normalizeLocation(item.location).toLowerCase()].join("|");
}

/** Blank template using the same headers accepted by CSV import. */
export function csvTemplate():string {return csvExport([])+"\r\n";}

export function categorySummary(items:Item[]):{category:Category;records:number;quantity:number;value:number}[] {
 return categories.map(category=>{const matching=items.filter(i=>i.category===category);return {category,records:matching.length,quantity:matching.reduce((sum,i)=>sum+i.quantity,0),value:totalValue(matching)};}).filter(group=>group.records>0);
}

export function locationSummary(items:Item[]):{location:string;records:number;quantity:number;value:number}[] {
 const roots=[...new Set(items.map(i=>normalizeLocation(i.location).split(" / ")[0]).filter(Boolean))];
 return roots.map(location=>{const group=itemsAtLocation(items,location);return {location,records:group.length,quantity:group.reduce((sum,i)=>sum+i.quantity,0),value:totalValue(group)};}).sort((a,b)=>b.value-a.value||a.location.localeCompare(b.location));
}

export function warrantyQueue(items:Item[],today=new Date().toISOString().slice(0,10)):Item[] {
 const rank={expired:0,expiring:1,active:2,unknown:3};
 return items.filter(i=>["expired","expiring"].includes(warrantyStatus(i,today))).sort((a,b)=>rank[warrantyStatus(a,today)]-rank[warrantyStatus(b,today)]||(a.warrantyEnd??"").localeCompare(b.warrantyEnd??"")||a.name.localeCompare(b.name));
}

export function serviceCostSummary(items:Item[]):{id:string;name:string;location:string;cost:number;services:number}[] {
 return items.map(i=>({id:i.id,name:i.name,location:i.location,cost:(i.serviceHistory??[]).reduce((sum,r)=>sum+r.cost,0),services:i.serviceHistory?.length??0})).filter(i=>i.services>0).sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name));
}

export type MissingDetail="Brand"|"Model"|"Serial number"|"Purchase date"|"Warranty date";
export function missingItemDetails(item:Item):MissingDetail[] {
 const fields:[MissingDetail,string|undefined][]=[["Brand",item.brand],["Model",item.model],["Serial number",item.serialNumber],["Purchase date",item.purchaseDate],["Warranty date",item.warrantyEnd]];
 return fields.filter(([,value])=>!value?.trim()).map(([name])=>name);
}
export function incompleteInventory(items:Item[]):{item:Item;missing:MissingDetail[]}[] {
 return items.map(item=>({item,missing:missingItemDetails(item)})).filter(entry=>entry.missing.length>0).sort((a,b)=>b.missing.length-a.missing.length||a.item.name.localeCompare(b.item.name));
}

export function mostValuableItems(items:Item[],limit=5):{item:Item;total:number;share:number}[] {
 const grandTotal=totalValue(items);
 return items.map(item=>({item,total:item.value*item.quantity,share:grandTotal>0?item.value*item.quantity/grandTotal:0})).sort((a,b)=>b.total-a.total||a.item.name.localeCompare(b.item.name)).slice(0,Math.max(0,limit));
}

/** Export every recorded service event, one row per event. */
export function serviceHistoryCSV(items:Item[]):string {
 const escape=(v:string|number)=>'"'+String(v).replaceAll('"','""')+'"';
 const rows:[string,string,string,string,string,string,string,string][]=[["Equipment","Location","Category","Date","Task","Cost","Notes","Record ID"]];
 for(const item of items)for(const record of item.serviceHistory??[])rows.push([item.name,item.location,item.category,record.date,record.task,String(record.cost),record.notes,record.id]);
 return rows.map(row=>row.map(escape).join(",")).join("\r\n");
}

/** Export warranty coverage for all inventory records, including unknown dates. */
export function warrantyCSV(items:Item[],today=new Date().toISOString().slice(0,10)):string {
 const escape=(value:string|number)=>'"'+String(value).replaceAll('"','""')+'"';
 const rows=[["Equipment","Brand","Model","Serial Number","Category","Location","Purchase Date","Warranty End","Status"]];
 for(const item of items)rows.push([item.name,item.brand??"",item.model??"",item.serialNumber??"",item.category,item.location,item.purchaseDate??"",item.warrantyEnd??"",warrantyStatus(item,today)]);
 return rows.map(row=>row.map(escape).join(",")).join("\r\n");
}
