-- ==============================================================================
-- PRODUCTION ENVIRONMENT GUARD: STRICTLY LOCAL / STAGING SEED DATA
-- ==============================================================================
-- WARNING: This seed script provisions mock demo accounts and test data.
-- NEVER execute this against a production database.
-- ==============================================================================

DO $$
BEGIN
  -- Abort execution if connected to a production database or if app.environment=production
  IF current_database() ~* 'prod' OR current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'CRITICAL: Refusing to execute seed.sql on production database (%)', current_database();
  END IF;
END $$;

-- Seed Data for QUALUTION Community Portal MVP
-- Includes 4 Demo Users (Student, Researcher, Teacher, Admin), sample Posts for all sections, and 6 Opportunities.
-- All data is explicitly marked as [DEMO DATA].

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Insert Demo Users into auth.users (if not already present)
-- We insert into auth.users using fixed UUIDs so foreign key references in public.profiles succeed.
DO $$
DECLARE
  v_student_id uuid := '00000000-0000-0000-0000-000000000001';
  v_researcher_id uuid := '00000000-0000-0000-0000-000000000002';
  v_teacher_id uuid := '00000000-0000-0000-0000-000000000003';
  v_admin_id uuid := '00000000-0000-0000-0000-000000000004';
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      v_student_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'demo_student@qualution.test',
      crypt('demo-password-123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"handle":"quantum_student","display_name":"Alice Student [DEMO]","role":"student"}'::jsonb,
      now(),
      now()
    ),
    (
      v_researcher_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'demo_researcher@qualution.test',
      crypt('demo-password-123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"handle":"dr_quantum","display_name":"Dr. Bob Researcher [DEMO]","role":"researcher"}'::jsonb,
      now(),
      now()
    ),
    (
      v_teacher_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'demo_teacher@qualution.test',
      crypt('demo-password-123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"handle":"prof_qubit","display_name":"Prof. Carol Teacher [DEMO]","role":"teacher"}'::jsonb,
      now(),
      now()
    ),
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'demo_admin@qualution.test',
      crypt('demo-password-123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"handle":"qualution_admin","display_name":"Dave Admin [DEMO]","role":"professional"}'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Upsert Profiles for Demo Users
  -- (Trigger on auth.users will have created base rows; we guarantee full fields here)
  INSERT INTO public.profiles (
    id, handle, display_name, role, institution, bio, interests, links, is_verified, app_role, created_at, updated_at
  )
  VALUES
    (
      v_student_id,
      'quantum_student',
      'Alice Student [DEMO]',
      'student',
      'University of Technology [DEMO]',
      'Passionate undergraduate exploring superposition and quantum algorithms.',
      ARRAY['grovers-algorithm', 'superposition', 'qiskit'],
      '{"github": "https://github.com/alice-quantum-demo"}'::jsonb,
      false,
      'user',
      now(),
      now()
    ),
    (
      v_researcher_id,
      'dr_quantum',
      'Dr. Bob Researcher [DEMO]',
      'researcher',
      'National Quantum Institute [DEMO]',
      'Senior researcher in quantum error correction and topological quantum computing.',
      ARRAY['qec', 'surface-codes', 'fault-tolerance', 'bloch-sphere'],
      '{"orcid": "https://orcid.org/0000-0000-0000-0000", "website": "https://quantum-research.demo"}'::jsonb,
      true,
      'user',
      now(),
      now()
    ),
    (
      v_teacher_id,
      'prof_qubit',
      'Prof. Carol Teacher [DEMO]',
      'teacher',
      'Institute for Quantum Information [DEMO]',
      'Educator building hands-on curriculum for undergraduate quantum physics.',
      ARRAY['quantum-education', 'curriculum', 'telemetry', 'pedagogy'],
      '{"twitter": "https://x.com/prof_qubit_demo"}'::jsonb,
      true,
      'user',
      now(),
      now()
    ),
    (
      v_admin_id,
      'qualution_admin',
      'Dave Admin [DEMO]',
      'professional',
      'QUALUTION Foundation [DEMO]',
      'Community lead and platform moderator for the Qualution Community Portal.',
      ARRAY['community', 'quantum-cloud', 'platform-governance'],
      '{"website": "https://qualution.io"}'::jsonb,
      true,
      'admin',
      now(),
      now()
    )
  ON CONFLICT (id) DO UPDATE SET
    handle = EXCLUDED.handle,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    institution = EXCLUDED.institution,
    bio = EXCLUDED.bio,
    interests = EXCLUDED.interests,
    links = EXCLUDED.links,
    is_verified = EXCLUDED.is_verified,
    app_role = EXCLUDED.app_role;

END $$;

-- 3. Sample Posts for All 5 Sections
INSERT INTO public.posts (
  id, author_id, section, title, body, link_url, tags, meta, status, created_at, updated_at
)
VALUES
  -- 3.1 COURSES SECTION
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003', -- Prof. Carol (Teacher)
    'courses',
    'Interactive Quantum Mechanics 101: Understanding Qubits and Phase Shifts [DEMO]',
    'Welcome to the interactive foundations course! In this module we explore Bloch sphere geometry, single-qubit transformations (Pauli-X, Y, Z, and Hadamard), and phase interference before measuring states.',
    'https://learn.qualution.io/courses/quantum-101',
    ARRAY['course', 'qubit-basics', 'hadamard', 'education'],
    '{"level": "beginner", "duration_weeks": 4}'::jsonb,
    'published',
    now() - interval '5 days',
    now() - interval '5 days'
  ),

  -- 3.2 NEWS SECTION
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004', -- Dave (Admin)
    'news',
    'Breakthrough in Low-Overhead Surface Code Architectures Announced [DEMO]',
    'Researchers worldwide have demonstrated a milestone reduction in the physical-to-logical qubit ratio, paving the path towards real-time syndrome extraction on superconducting chips.',
    'https://quantum-news.demo/surface-code-milestone',
    ARRAY['news', 'qec', 'hardware', 'fault-tolerance'],
    '{"source": "Quantum Times", "verified": true}'::jsonb,
    'published',
    now() - interval '3 days',
    now() - interval '3 days'
  ),

  -- 3.3 RESEARCH SECTION
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002', -- Dr. Bob (Researcher)
    'research',
    'Optimized Clifford+T Synthesis via Graph State Decomposition [DEMO]',
    'We present a polynomial-time algorithm for compiling arbitrary n-qubit unitaries into minimal T-depth Clifford+T circuits using ZX-calculus graph rewrites.',
    'https://arxiv.org/abs/2610.99999',
    ARRAY['research', 't-depth', 'compilation', 'zx-calculus'],
    '{
      "paper_url": "https://arxiv.org/pdf/2610.99999.pdf",
      "abstract": "Compilation of fault-tolerant unitaries is bounded by T-gate overhead. This work demonstrates an average 38% reduction in T-depth across 20-qubit benchmarking circuits."
    }'::jsonb,
    'published',
    now() - interval '2 days',
    now() - interval '2 days'
  ),

  -- 3.4 EVENTS SECTION
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000003', -- Prof. Carol (Teacher)
    'events',
    'Global Quantum Hackathon 2026: 48h Virtual Circuit Design Sprint [DEMO]',
    'Join students and researchers across 40 countries for the annual Qualution Community Hackathon. Compete in tracks covering Quantum Chemistry, Cryptanalysis, and Machine Learning.',
    'https://hackathon.qualution.demo',
    ARRAY['hackathon', 'competition', 'community', 'networking'],
    '{"event_date": "2026-11-15", "location": "Online / Virtual", "prizes_usd": 25000}'::jsonb,
    'published',
    now() - interval '1 day',
    now() - interval '1 day'
  ),

  -- 3.5 QUALUTION SECTION
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000004', -- Dave (Admin)
    'qualution',
    'Qualution Engine v2.4 Released: Hybrid WebAssembly & GPU Acceleration [DEMO]',
    'We are thrilled to announce Qualution Studio Engine 2.4. Featuring zero-latency client-side WebAssembly Clifford stabilization, statevector worker threading, and NVIDIA cuQuantum cloud connectivity.',
    'https://qualution.io/updates/release-v2.4',
    ARRAY['qualution', 'release', 'wasm', 'cuquantum', 'simulator'],
    '{"version": "2.4.0", "changelog_url": "https://qualution.io/changelog"}'::jsonb,
    'published',
    now() - interval '6 hours',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  section = EXCLUDED.section,
  status = EXCLUDED.status;

-- 4. Sample Opportunities (6 Diverse Kinds: internship, fellowship, hackathon, job, scholarship, other)
INSERT INTO public.opportunities (
  id, author_id, title, organisation, kind, description, apply_url, location, deadline, status, created_at, updated_at
)
VALUES
  -- 4.1 INTERNSHIP (Published, from verified researcher)
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002', -- Dr. Bob
    'Summer Quantum Algorithms Research Intern [DEMO]',
    'Quantum Institute Europe [DEMO]',
    'internship',
    'Work alongside leading physicists developing variational quantum eigensolvers (VQE) for molecular energy simulation.',
    'https://careers.quantum-institute.demo/internship-2026',
    'Zurich, Switzerland (Hybrid)',
    CURRENT_DATE + interval '45 days',
    'published',
    now() - interval '4 days',
    now() - interval '4 days'
  ),

  -- 4.2 FELLOWSHIP (Published, from verified teacher)
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003', -- Prof. Carol
    'Postdoctoral Fellowship in Quantum Error Correction [DEMO]',
    'Center for Quantum Information [DEMO]',
    'fellowship',
    'A 2-year funded postdoctoral fellowship investigating surface code decoders with machine learning heuristics.',
    'https://fellowships.quantum-info.demo/qec-2026',
    'Boston, MA, USA',
    CURRENT_DATE + interval '60 days',
    'published',
    now() - interval '3 days',
    now() - interval '3 days'
  ),

  -- 4.3 HACKATHON (Published)
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004', -- Dave (Admin)
    'Open Quantum Hardware Hackathon [DEMO]',
    'Open Quantum Initiative [DEMO]',
    'hackathon',
    'Compete to build open-source quantum pulse calibration routines on physical transmon qubit emulators.',
    'https://openq-hack.demo/register',
    'Global / Virtual',
    CURRENT_DATE + interval '20 days',
    'published',
    now() - interval '2 days',
    now() - interval '2 days'
  ),

  -- 4.4 JOB (Published)
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004', -- Dave (Admin)
    'Senior Quantum Compiler Engineer [DEMO]',
    'Qualution Technologies [DEMO]',
    'job',
    'Join our core simulation compiler team. Scale our Rust WebAssembly circuit execution engine and cloud GPU pipelines.',
    'https://qualution.io/careers/senior-compiler-engineer',
    'San Francisco, CA or Remote',
    CURRENT_DATE + interval '90 days',
    'published',
    now() - interval '1 day',
    now() - interval '1 day'
  ),

  -- 4.5 SCHOLARSHIP (Pending, from unverified student author)
  (
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001', -- Alice (Student, unverified)
    'Undergraduate Quantum Research Grant [DEMO]',
    'Student Quantum Society [DEMO]',
    'scholarship',
    'Micro-grants for undergraduate students publishing reproducible quantum computing circuit benchmarks.',
    'https://student-grants.quantum.demo/apply',
    'Worldwide',
    CURRENT_DATE + interval '30 days',
    'pending', -- Demonstrates unverified author auto-pending behavior
    now() - interval '12 hours',
    now() - interval '12 hours'
  ),

  -- 4.6 OTHER (Expired, for testing expire_opportunities function)
  (
    '20000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000003', -- Prof. Carol
    'Spring 2026 Quantum Teaching Assistant Call [DEMO]',
    'Physics Department [DEMO]',
    'other',
    'Recruiting undergraduate lab assistants for intro quantum circuit simulation lab sessions.',
    'https://physics.university.demo/jobs/ta-spring',
    'Campus Lab',
    CURRENT_DATE - interval '5 days', -- Past deadline
    'expired',
    now() - interval '30 days',
    now() - interval '5 days'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  organisation = EXCLUDED.organisation,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status;

-- 5. Sample Interactions: Comments, Reactions, Follows
INSERT INTO public.follows (follower_id, following_id, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', now() - interval '2 days'), -- Alice follows Prof. Carol
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now() - interval '2 days')  -- Alice follows Dr. Bob
ON CONFLICT (follower_id, following_id) DO NOTHING;

INSERT INTO public.reactions (user_id, post_id, kind, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'like', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'insightful', now() - interval '4 hours')
ON CONFLICT (user_id, post_id, kind) DO NOTHING;

INSERT INTO public.comments (id, post_id, author_id, body, status, created_at, updated_at)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', -- Alice (Student)
    'The interactive Bloch sphere exercises helped me finally visualize why H |0> equals (|0> + |1>)/sqrt(2)! [DEMO]',
    'published',
    now() - interval '1 day',
    now() - interval '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Reports (Open, for moderator verification)
INSERT INTO public.reports (id, reporter_id, target_type, target_id, reason, status, created_at, updated_at)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', -- Alice (Student)
    'post',
    '10000000-0000-0000-0000-000000000002',
    'Testing moderation reporting system functionality [DEMO]',
    'open',
    now() - interval '12 hours',
    now() - interval '12 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Telemetry Events (Preserving telemetry fixtures)
INSERT INTO public.portal_telemetry_events (session_id, event_type, event_payload, created_at)
VALUES
  ('seed-session-001', 'portal_view', '{"page": "/portal", "source": "navigation"}'::jsonb, now() - interval '1 day'),
  ('seed-session-002', 'quantum_simulation', '{"backend": "qiskit_aer", "qubits": 2, "gates": 3}'::jsonb, now() - interval '12 hours'),
  ('seed-session-003', 'community_share', '{"circuit": "Bell State", "shared_publicly": true}'::jsonb, now() - interval '2 hours')
ON CONFLICT DO NOTHING;
