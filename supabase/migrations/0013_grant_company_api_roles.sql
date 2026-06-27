-- Allow authenticated API reads while keeping browser-side company writes blocked.

revoke all on table public.companies from anon;
revoke insert, update, delete on table public.companies from authenticated;
grant select on table public.companies to authenticated;
grant select, insert, update, delete on table public.companies to service_role;
