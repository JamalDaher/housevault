-- Transactional household creation, avoiding INSERT RETURNING visibility before owner bootstrap.
create function public.create_household(target_name text)
returns table(id uuid,name text,created_by uuid)
language plpgsql security definer set search_path=''
as $$
declare new_id uuid; actor uuid;
begin
 actor := auth.uid();
 if actor is null then raise exception 'Sign in required'; end if;
 if target_name is null or length(btrim(target_name)) not between 1 and 120 then raise exception 'Invalid household name'; end if;
 insert into public.households(name,created_by) values(btrim(target_name),actor) returning households.id into new_id;
 return query select h.id,h.name,h.created_by from public.households h where h.id=new_id and h.created_by=actor;
end
$$;
revoke all on function public.create_household(text) from public,anon;
grant execute on function public.create_household(text) to authenticated;