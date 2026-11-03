import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const sql=readFileSync(new URL("../supabase/migrations/20261103010000_inventory_revisions.sql",import.meta.url),"utf8");

describe("revision migration security contract",()=>{
 it("enables row level security and restricts direct writes",()=>{
  expect(sql).toMatch(/alter table public\.inventory_revisions enable row level security/i);
  expect(sql).toMatch(/revoke all on public\.inventory_revisions from anon, authenticated/i);
  expect(sql).toMatch(/grant select on public\.inventory_revisions to authenticated/i);
  expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+public\.inventory_revisions\s+to\s+authenticated/i);
 });
 it("restricts reads to household owners and members",()=>{
  expect(sql).toMatch(/create policy "read own household revisions"/i);
  expect(sql).toMatch(/h\.created_by=auth\.uid\(\)/i);
  expect(sql).toMatch(/m\.user_id=auth\.uid\(\)/i);
 });
 it("requires authenticated RPC access and a fixed search path",()=>{
  expect(sql).toMatch(/security definer set search_path\s*=\s*''/i);
  expect(sql).toMatch(/revoke all on function public\.write_inventory_revision\(uuid,text,uuid,jsonb\) from public/i);
  expect(sql).toMatch(/grant execute on function public\.write_inventory_revision\(uuid,text,uuid,jsonb\) to authenticated/i);
  expect(sql).toMatch(/v_role not in \('owner','editor'\)/i);
 });
 it("checks the expected revision before writing",()=>{
  expect(sql).toMatch(/v_revision is distinct from p_expected/i);
  expect(sql).toMatch(/raise exception 'Revision conflict'/i);
  expect(sql).toMatch(/pg_advisory_xact_lock/i);
 });
});
