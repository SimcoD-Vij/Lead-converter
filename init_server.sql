INSERT INTO users (id, provider_id) VALUES (3, 'oss_1773400278354_aa416db6-4cb2-45e8-8e96-627f6376a731') ON CONFLICT (id) DO NOTHING;
INSERT INTO organizations (id, provider_id) VALUES (3, 'org_oss_1773400278354_aa416db6-4cb2-45e8-8e96-627f6376a731') ON CONFLICT (id) DO NOTHING;
INSERT INTO organization_users (user_id, organization_id) VALUES (3, 3) ON CONFLICT (user_id, organization_id) DO NOTHING;

INSERT INTO api_keys (id, organization_id, created_by, key_prefix, key_hash, name, is_active) 
VALUES (5, 3, 3, 'dgr_fgXK', '36166ce5f29d201e5200bad0de13cbcf73bdf424cbf6b0ccaaa514f3252ab491fef8c754a', 'Server api', true) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflows (id, organization_id, user_id, name, status, workflow_definition) 
VALUES (6, 3, 3, 'Smart Battery Pitch', 'active', '{"nodes":[],"edges":[]}') 
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations));
SELECT setval('api_keys_id_seq', (SELECT MAX(id) FROM api_keys));
SELECT setval('workflows_id_seq', (SELECT MAX(id) FROM workflows));
