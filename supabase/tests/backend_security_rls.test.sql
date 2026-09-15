-- Run with `supabase test db` after linking a local Supabase project.
-- These assertions complement the TypeScript authorization tests: service-role
-- code must authorize separately because it bypasses RLS.
begin;
select plan(16);

select ok(relrowsecurity, 'wallet identities has RLS')
from pg_class where oid = 'public.wallet_identities'::regclass;
select ok(relrowsecurity, 'matters has RLS')
from pg_class where oid = 'public.matters'::regclass;
select ok(relrowsecurity, 'private evidence metadata has RLS')
from pg_class where oid = 'public.evidence_files'::regclass;
select ok(relrowsecurity, 'auth challenges has RLS')
from pg_class where oid = 'public.auth_challenges'::regclass;

select ok(not has_table_privilege('anon', 'public.auth_challenges', 'select,insert,update,delete'), 'anon cannot access challenges');
select ok(not has_table_privilege('authenticated', 'public.auth_challenges', 'select,insert,update,delete'), 'users cannot access challenges directly');
select ok(not has_table_privilege('anon', 'public.evidence_files', 'insert,update,delete'), 'anon cannot write evidence metadata');
select ok(not has_table_privilege('authenticated', 'public.evidence_files', 'insert,update,delete'), 'users cannot write evidence metadata directly');
select ok(not has_table_privilege('authenticated', 'public.matters', 'insert,update,delete'), 'users cannot mutate matters directly');
select ok(has_table_privilege('anon', 'public.services', 'select'), 'anon can read public-service rows subject to RLS');
select ok(has_table_privilege('authenticated', 'public.matters', 'select'), 'authenticated users have only member-filtered matter reads');
select ok(not has_table_privilege('anon', 'storage.objects', 'select,insert,update,delete'), 'anon cannot access private objects');
select ok(not has_table_privilege('authenticated', 'storage.objects', 'select,insert,update,delete'), 'authenticated users cannot bypass signed-download checks');

select ok(not has_function_privilege('anon', 'public.consume_wallet_challenge(uuid, uuid, text, text)', 'execute'), 'anon cannot consume challenges');
select ok(not has_function_privilege('authenticated', 'public.consume_wallet_challenge(uuid, uuid, text, text)', 'execute'), 'authenticated users cannot consume challenges');
select ok(not has_function_privilege('anon', 'public.create_matter_draft(uuid, text, uuid, text, text)', 'execute'), 'anon cannot create drafts by RPC');
select ok(not has_function_privilege('authenticated', 'public.create_consensus_evidence_entry(uuid, text, text, uuid, uuid)', 'execute'), 'authenticated users cannot stage public evidence by RPC');

select * from finish();
rollback;
