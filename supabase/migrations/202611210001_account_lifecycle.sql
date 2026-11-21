begin;

-- Tracks whether a customer has finished the post-signup setup flow.
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;

-- Customers can remove their own auth identity. This must be a security
-- definer function because only privileged roles may write to auth.users.
-- All related public rows cascade (addresses, staff permissions) or are
-- anonymised (orders keep the row but drop customer_id).
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'Only customer accounts can be self-deleted';
  end if;

  delete from public.addresses where customer_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

commit;
