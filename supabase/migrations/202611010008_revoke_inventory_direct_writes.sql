-- Defense in depth: browser writes must use revision-checked RPCs.
revoke insert,update,delete on public.inventory_records from authenticated,anon;
revoke insert,update,delete on public.inventory_attachments from authenticated,anon;
