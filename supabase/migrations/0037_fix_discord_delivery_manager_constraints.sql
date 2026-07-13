alter table public.discord_weekly_briefing_deliveries
  drop constraint discord_weekly_briefing_deliveries_account_manager_check;

alter table public.discord_weekly_briefing_deliveries
  add constraint discord_weekly_briefing_deliveries_account_manager_check check (account_manager in (
    '정현정', '박종열', '류희재', '허진석', '이영준', '주재형', '이정준'
  ));

alter table public.discord_briefing_test_deliveries
  drop constraint discord_briefing_test_deliveries_account_manager_check;

alter table public.discord_briefing_test_deliveries
  add constraint discord_briefing_test_deliveries_account_manager_check check (account_manager in (
    '정현정', '박종열', '류희재', '허진석', '이영준', '주재형', '이정준'
  ));
