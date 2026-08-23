alter function public.create_device_pairing(text, text) security invoker;
alter function public.revoke_device_token(bigint) security invoker;

create policy device_pairings_owner_insert
on public.device_pairings for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy device_pairings_owner_delete
on public.device_pairings for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy device_tokens_owner_update
on public.device_tokens for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

grant insert, delete on table public.device_pairings to authenticated;
grant update on table public.device_tokens to authenticated;
grant usage, select on sequence public.device_pairings_id_seq to authenticated;
