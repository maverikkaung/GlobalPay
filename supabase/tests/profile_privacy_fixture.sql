-- Synthetic profiles only. This fixture belongs to a disposable test database.
insert into auth.users (id, raw_user_meta_data) values
  ('94000000-0000-4000-8000-000000000001', '{"full_name":"Fixture Freelancer","account_type":"freelancer"}'),
  ('94000000-0000-4000-8000-000000000002', '{"full_name":"Fixture Client","account_type":"client"}'),
  ('94000000-0000-4000-8000-000000000003', '{"full_name":"Blocked Client","account_type":"client"}'),
  ('94000000-0000-4000-8000-000000000004', '{"full_name":"Other Freelancer","account_type":"freelancer"}');

insert into public.portfolio_items (id, freelancer_id, title, project_url) values
  ('94000000-0000-4000-8000-000000000010', '94000000-0000-4000-8000-000000000001',
    'Fixture project', 'https://work.example.test/project');

-- Seed projected review records. Contract eligibility and real review insertion
-- are independently exercised by contract_delivery_rls_workflows.sql.
insert into public.reviews (id, application_id, job_id, reviewer_id, reviewee_id, rating, body) values
  ('94000000-0000-4000-8000-000000000011', 'privacy-fixture-1', 'privacy-fixture-job',
    '94000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000001', 4, 'Clear communication'),
  ('94000000-0000-4000-8000-000000000012', 'privacy-fixture-2', 'privacy-fixture-job',
    '94000000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000004', 5, 'Helpful handoff');

insert into public.connections (id, requester_id, recipient_id) values
  ('94000000-0000-4000-8000-000000000013', '94000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000014', '94000000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000001');

insert into public.user_blocks (blocker_id, blocked_id)
values ('94000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000003');

insert into public.jobs (id, client_id, title, description, budget)
values ('94000000-0000-4000-8000-000000000015', '94000000-0000-4000-8000-000000000002',
  'Fixture job', 'Fixture for legacy active work authorization', 100);

insert into public.job_applications (job_id, client_id, freelancer_id, status)
values ('94000000-0000-4000-8000-000000000015', '94000000-0000-4000-8000-000000000002',
  '94000000-0000-4000-8000-000000000004', 'Accepted');
