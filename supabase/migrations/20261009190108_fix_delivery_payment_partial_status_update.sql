do $$
declare d text;
begin
 d:=pg_get_functiondef('public.delivery_admin_update_payment(text,uuid,date,text,numeric,text,text,text)'::regprocedure);
 d:=replace(d, 'new_status text := upper(coalesce(p_status,''PENDING''));','new_status text;');
 d:=replace(d, 'if p_amount is null or p_amount <= 0 then', 'p_amount := coalesce(p_amount,old.amount);
  new_status := upper(coalesce(p_status,old.status));
  if new_status not in (''PENDING'',''VERIFIED'',''REJECTED'') then raise exception ''Invalid payment status''; end if;
  if p_amount <= 0 then');
 d:=replace(d,'transaction_id=nullif(trim(coalesce(p_transaction_id,'''')),''''),note=p_note','transaction_id=case when p_transaction_id is null then transaction_id else nullif(trim(p_transaction_id),'''') end,note=coalesce(p_note,note)');
 execute d;
end $$;