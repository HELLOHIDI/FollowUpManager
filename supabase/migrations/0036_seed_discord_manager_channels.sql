alter table public.discord_manager_channels
  drop constraint discord_manager_channels_account_manager_check;

alter table public.discord_manager_channels
  add constraint discord_manager_channels_account_manager_check check (account_manager in (
    '정현정', '박종열', '류희재', '허진석', '이영준', '주재형', '이정준'
  ));

insert into public.discord_manager_channels (account_manager, discord_channel_id)
values
  ('정현정', '1525169675602886656'),
  ('박종열', '1525169745689706649'),
  ('류희재', '1525169777432203497'),
  ('허진석', '1525169816338698362'),
  ('이영준', '1525169871103590460'),
  ('주재형', '1525169897288761474'),
  ('이정준', '1525169922068709507')
on conflict (account_manager) do update
set discord_channel_id = excluded.discord_channel_id;
