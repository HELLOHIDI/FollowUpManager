begin;

select plan(7);

select ok(
  has_function_privilege('service_role', 'public.claim_discord_weekly_briefing_delivery(text,text,text,uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.claim_discord_weekly_briefing_delivery(text,text,text,uuid,jsonb)', 'execute'),
  'only the service role can claim scheduled deliveries'
);

select ok(
  has_function_privilege('service_role', 'public.renew_discord_weekly_briefing_delivery_lease(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.renew_discord_weekly_briefing_delivery_lease(uuid,uuid)', 'execute'),
  'only the service role can renew delivery leases'
);

do $$
begin
  begin
    insert into public.discord_manager_channels (account_manager, discord_channel_id)
    values ('not-a-manager', '12345678901234567');
    raise exception 'invalid manager was accepted';
  exception when check_violation then null;
  end;
end;
$$;
select pass('fixed manager constraints reject unknown managers');

with first_claim as (
  select * from public.claim_discord_weekly_briefing_delivery(
    '2099-07-2', U&'\C815\D604\C815', 'company:00000000-0000-4000-8000-000000000035', null, '[]'::jsonb
  )
), second_claim as (
  select * from public.claim_discord_weekly_briefing_delivery(
    '2099-07-2', U&'\C815\D604\C815', 'company:00000000-0000-4000-8000-000000000035', null, '[]'::jsonb
  )
)
select is((select count(*) from first_claim), 1::bigint, 'first weekly claim succeeds')
union all
select is((select count(*) from second_claim), 0::bigint, 'concurrent duplicate claim is refused');

insert into public.discord_weekly_briefing_deliveries (
  seoul_week_key, account_manager, scope_key, message_chunks, claim_token, lease_expires_at, external_request_started_at, external_request_step
) values (
  '2099-07-3', U&'\C815\D604\C815', 'manager-empty', '[]'::jsonb, gen_random_uuid(), now() - interval '1 minute', now() - interval '6 minutes', 'parent'
);
select is(
  (select count(*) from public.claim_discord_weekly_briefing_delivery('2099-07-3', U&'\C815\D604\C815', 'manager-empty', null, '[]'::jsonb)),
  0::bigint,
  'expired delivery with an external request marker is not reclaimed automatically'
);
select is(
  (select status from public.discord_weekly_briefing_deliveries where seoul_week_key = '2099-07-3'),
  'needs_review',
  'expired delivery with an external request marker is surfaced for operator review'
);

select * from finish();

rollback;
