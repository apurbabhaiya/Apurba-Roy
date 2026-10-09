do $$
declare d text; signature text;
begin
 foreach signature in array array[
 'public.delivery_admin_add_payment(text,uuid,date,text,numeric,text,text,text)',
 'public.delivery_admin_restore_access(text,uuid,integer,boolean)',
 'public.delivery_admin_review_payment(text,uuid,text)'
 ] loop
  d:=pg_get_functiondef(signature::regprocedure);
  d:=replace(d,',p_token)',',''admin-session:''||encode(digest(p_token,''sha256''),''hex''))');
  execute d;
 end loop;
end $$;
update public.delivery_payments set verified_by='admin-session:'||encode(digest(verified_by,'sha256'),'hex') where verified_by ~ '^[0-9a-f]{64}$';
update public.delivery_access_fees set verified_by='admin-session:'||encode(digest(verified_by,'sha256'),'hex') where verified_by ~ '^[0-9a-f]{64}$';