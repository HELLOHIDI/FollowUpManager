begin;

select plan(8);

select has_table('public', 'project_schedules', 'project schedules table exists');
select has_table('public', 'discord_schedule_reminder_deliveries', 'schedule reminder delivery table exists');

select has_index(
  'public',
  'project_schedules',
  'project_schedules_project_scheduled_on_idx',
  'project schedule lookup index exists'
);

select has_index(
  'public',
  'discord_schedule_reminder_deliveries',
  'discord_schedule_reminder_deliveries_status_event_date_idx',
  'reminder due lookup index exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_discord_schedule_reminder_delivery(uuid,uuid,uuid,text,date,text,text)',
    'execute'
  ) and not has_function_privilege(
    'anon',
    'public.claim_discord_schedule_reminder_delivery(uuid,uuid,uuid,text,date,text,text)',
    'execute'
  ),
  'only the service role can claim schedule reminder deliveries'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.renew_discord_schedule_reminder_delivery_lease(uuid,uuid)',
    'execute'
  ) and not has_function_privilege(
    'anon',
    'public.renew_discord_schedule_reminder_delivery_lease(uuid,uuid)',
    'execute'
  ),
  'only the service role can renew schedule reminder leases'
);

select policies_are(
  'public',
  'project_schedules',
  array['Authenticated users can manage project schedules'],
  'project schedules keep the authenticated CRUD policy'
);

select policies_are(
  'public',
  'discord_schedule_reminder_deliveries',
  array['Authenticated users can read Discord schedule reminder deliveries'],
  'reminder deliveries are read-only to authenticated operators'
);

select * from finish();

rollback;
