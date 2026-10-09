alter policy "authenticated update branding assets" on storage.objects
using (bucket_id='branding-assets' and owner_id=(select auth.uid())::text)
with check (bucket_id='branding-assets' and owner_id=(select auth.uid())::text);
revoke execute on function public.auto_activate_fully_paid_delivery() from public,anon,authenticated;