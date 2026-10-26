-- Public client calendar exposes only the dates and count of booked/confirmed team work.
-- No client identity, contact details, event title, or venue is returned.
create or replace function public.booking_public_team_schedule(p_month date)
returns table(event_date date, booking_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select e.event_date, count(*)::bigint as booking_count
  from public.booking_events as e
  join public.booking_clients as b on b.id = e.booking_id
  where p_month is not null
    and date_trunc('month', p_month)::date >= date_trunc('month', current_date)::date
    and date_trunc('month', p_month)::date <= (date_trunc('month', current_date) + interval '12 months')::date
    and e.event_date >= greatest(current_date, date_trunc('month', p_month)::date)
    and e.event_date < (date_trunc('month', p_month) + interval '1 month')::date
    and b.status in ('booked', 'confirmed')
    and b.deleted_at is null
  group by e.event_date
  order by e.event_date;
$function$;

revoke all on function public.booking_public_team_schedule(date) from public, anon, authenticated;
grant execute on function public.booking_public_team_schedule(date) to anon, authenticated;
