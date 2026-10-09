create or replace function public.delivery_total_paid(p_portal_id uuid)
returns numeric language sql security definer set search_path=public,extensions as $$
 select coalesce((select verified_total_paid from public.delivery_portals where id=p_portal_id),0);
$$;
do $$ declare d text; begin
 d:=pg_get_functiondef('public.delivery_admin_review_payment(text,uuid,text)'::regprocedure);
 d:=replace(d,'v_total_paid:=v_new_total+coalesce((select sum(amount) from public.delivery_payments where portal_id=p.id and status=''VERIFIED''),0);','v_total_paid:=v_new_total;');
 execute d;
 d:=pg_get_functiondef('public.delivery_admin_set_advance_paid(text,uuid,numeric)'::regprocedure);
 d:=replace(d,'v_all_total := v_total + coalesce((select sum(amount) from public.delivery_payments where portal_id=p.id and status=''VERIFIED''),0);','v_all_total := v_total;');
 execute d;
end $$;