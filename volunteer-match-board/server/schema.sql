-- Volunteer Match Board - Code Milestone 1 PostgreSQL schema

DROP TABLE IF EXISTS signups;
DROP TABLE IF EXISTS opportunities;

CREATE TABLE opportunities (
  id SERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  organization VARCHAR(120) NOT NULL,
  location VARCHAR(120) NOT NULL,
  event_date VARCHAR(80) NOT NULL,
  event_time VARCHAR(80) NOT NULL DEFAULT 'TBD',
  description TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT ARRAY['General Help'],
  spots_open INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE signups (
  id SERIAL PRIMARY KEY,
  volunteer_name VARCHAR(120) NOT NULL,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO opportunities
  (id, title, organization, location, event_date, event_time, description, skills, spots_open)
VALUES
  (1, 'Food Bank Helper', 'Heartland Food Pantry', 'Omaha, NE', 'Saturday, June 20', '9:00 AM - 12:00 PM', 'Help sort donated food and prepare pickup boxes for local families.', ARRAY['Organization', 'Customer Service'], 8),
  (2, 'Park Cleanup Crew', 'Green City Volunteers', 'Lincoln, NE', 'Sunday, June 21', '10:00 AM - 1:00 PM', 'Join a local cleanup event to remove litter and improve a community park.', ARRAY['Outdoor Work', 'Teamwork'], 12),
  (3, 'Animal Shelter Assistant', 'Safe Paws Shelter', 'Bellevue, NE', 'Wednesday, June 24', '5:30 PM - 7:30 PM', 'Support shelter staff by helping with basic cleaning, feeding, and animal socialization.', ARRAY['Animal Care', 'Patience'], 5),
  (4, 'Senior Center Tech Help', 'Community Connections', 'Papillion, NE', 'Friday, June 26', '3:00 PM - 5:00 PM', 'Assist seniors with basic technology questions such as email, phones, and online forms.', ARRAY['Basic Computers', 'Communication'], 6);

SELECT setval('opportunities_id_seq', (SELECT MAX(id) FROM opportunities));
