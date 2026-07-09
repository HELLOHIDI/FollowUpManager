alter table public.projects
  drop constraint if exists projects_manager_contact_check,
  drop constraint if exists projects_manager_name_check,
  alter column manager_name drop not null,
  alter column manager_name set default '';
