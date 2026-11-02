-- Private household attachment bucket. No public access or overwrite/delete policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('housevault-attachments','housevault-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create policy "housevault_attachment_read" on storage.objects
for select to authenticated using(
 bucket_id='housevault-attachments'
 and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
 and public.household_role(((storage.foldername(name))[1])::uuid) is not null
);
create policy "housevault_attachment_upload" on storage.objects
for insert to authenticated with check(
 bucket_id='housevault-attachments'
 and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
 and public.household_role(((storage.foldername(name))[1])::uuid) in ('owner','editor')
);

 and public.household_role(((storage.foldername(name))[1])::uuid) is not null
);
create policy "housevault_attachment_upload" on storage.objects
for insert to authenticated with check(
 bucket_id='housevault-attachments'
 and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
 and public.household_role(((storage.foldername(name))[1])::uuid) in ('owner','editor')
);

 and public.household_role(((storage.foldername(name))[1])::uuid) in ('owner','editor')
);
