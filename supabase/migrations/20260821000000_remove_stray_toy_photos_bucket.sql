-- Retires the toy-photos bucket's policies.
--
-- toy-photos was created by a migration written without knowledge of
-- 20260819000000_household_backup.sql, which already provides toy-images with
-- household-scoped policies. Two private photo buckets with different
-- ownership models is worse than either alone: whichever one the app did not
-- use would sit there accumulating nothing while looking load-bearing.
--
-- Only the policies are dropped here. The bucket row itself cannot be removed
-- from SQL — storage.buckets carries a trigger that raises "Direct deletion
-- from storage tables is not allowed. Use the Storage API instead." — so the
-- bucket is deleted through the Storage API by whoever runs this deployment.
-- Dropping the policies first is the part that matters for safety: with them
-- gone the bucket is unreachable by any authenticated caller even while the
-- empty row survives.
drop policy if exists "Toy photos are readable by their owner" on storage.objects;
drop policy if exists "Toy photos are uploadable by their owner" on storage.objects;
drop policy if exists "Toy photos are replaceable by their owner" on storage.objects;
drop policy if exists "Toy photos are deletable by their owner" on storage.objects;
