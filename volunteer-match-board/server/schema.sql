-- Volunteer Match Board - Code Milestone 2 PostgreSQL schema
-- This resets the local demo database. Run it before testing Milestone 2.

DROP TABLE IF EXISTS signups;
DROP TABLE IF EXISTS opportunities;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('volunteer', 'org')),
  organization_name VARCHAR(160),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT org_name_required CHECK (
    role <> 'org' OR organization_name IS NOT NULL
  )
);

CREATE TABLE opportunities (
  id SERIAL PRIMARY KEY,
  title VARCHAR(140) NOT NULL,
  organization_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location VARCHAR(140) NOT NULL,
  event_date VARCHAR(80) NOT NULL,
  event_time VARCHAR(80) NOT NULL DEFAULT 'TBD',
  description TEXT NOT NULL,
  requirements TEXT[] NOT NULL DEFAULT ARRAY['No special requirements'],
  skills TEXT[] NOT NULL DEFAULT ARRAY['General Help'],
  spots_total INTEGER NOT NULL DEFAULT 10 CHECK (spots_total > 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE signups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_volunteer_signup UNIQUE (user_id, opportunity_id)
);

INSERT INTO users
  (id, name, email, password_hash, role, organization_name)
VALUES
  (1, 'Demo Volunteer', 'demo.volunteer@example.com', '1049424513537cc9e78c27b8081f02ca:146ba947898cf62a6c0316289aba581724cd4b39367b7c584c37132d8fb0e04c10a0e29575441cfa9b8714b233d4dfcb0ad6120ca0db182d6ca0483b11138298', 'volunteer', NULL),
  (2, 'Food Center Admin', 'org.admin@example.com', 'f55619c82471983659e2b441244b89af:aa4a74ad160b5deb9fcdf20984147ed27c1e911c644a173cf3009197cd31d50cb6a52d5ae283611b6711093cf8d06892e868c8c3c332b97f1ce943b61b03a35f', 'org', 'Community Food Center'),
  (3, 'Parks Coordinator', 'parks.admin@example.com', '71bf0ce5e520c56b992f62127dd6c23b:9604e01623c6425c47431967ee8da1303281cfd054c737e541acbf58048cd0b0a9d27f5f2aa9d26c96747c53f3dcfcae6a512eb4d65d8bd9e4fbea6d17f3e63b', 'org', 'Green City Volunteers');

INSERT INTO opportunities
  (id, title, organization_id, location, event_date, event_time, description, requirements, skills, spots_total)
VALUES
  (1, 'Food Bank Helper', 2, 'Omaha, NE', 'June 15, 2026', '10:00 AM - 2:00 PM', 'Volunteers will help sort donated food, organize shelves, and prepare food boxes for families.', ARRAY['Must be able to stand for 2 hours', 'Closed-toe shoes required', 'No prior experience required'], ARRAY['Organization', 'Customer Service'], 5),
  (2, 'Park Cleanup Crew', 3, 'Lincoln, NE', 'June 21, 2026', '10:00 AM - 1:00 PM', 'Join a local cleanup event to remove litter, clear walking paths, and improve a community park.', ARRAY['Outdoor clothing recommended', 'Gloves provided'], ARRAY['Outdoor Work', 'Teamwork'], 12),
  (3, 'Animal Shelter Assistant', 2, 'Bellevue, NE', 'June 24, 2026', '5:30 PM - 7:30 PM', 'Support shelter staff by helping with basic cleaning, feeding, and animal socialization.', ARRAY['Comfortable around animals', 'Wear clothes that can get dirty'], ARRAY['Animal Care', 'Patience'], 5),
  (4, 'Senior Center Tech Help', 3, 'Papillion, NE', 'June 26, 2026', '3:00 PM - 5:00 PM', 'Assist seniors with basic technology questions such as email, phones, and online forms.', ARRAY['Basic computer confidence', 'Patient communication style'], ARRAY['Basic Computers', 'Communication'], 6);

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('opportunities_id_seq', (SELECT MAX(id) FROM opportunities));
