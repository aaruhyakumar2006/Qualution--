-- Migration: 20261003080000_teacher_portal_missing_tables.sql
-- Description: Additional schema tables for Students, Courses, Overview, Challenges, Certificates, Circuits, and Erwin Insights

-- 1. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    avatar text,
    course text NOT NULL,
    accuracy numeric NOT NULL DEFAULT 80.0,
    circuits_run integer NOT NULL DEFAULT 0,
    challenges_completed integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'Active',
    last_active text NOT NULL DEFAULT 'Just now',
    misconception_risk text NOT NULL DEFAULT 'Low',
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    title text NOT NULL,
    level text NOT NULL,
    students_count integer NOT NULL DEFAULT 0,
    modules_count integer NOT NULL DEFAULT 0,
    description text,
    instructor text NOT NULL DEFAULT 'Dr. Erwin Schrödinger',
    progress integer NOT NULL DEFAULT 0,
    tags text[] NOT NULL DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TEACHER OVERVIEW TABLE
CREATE TABLE IF NOT EXISTS public.teacher_overview (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    active_courses integer NOT NULL DEFAULT 0,
    students integer NOT NULL DEFAULT 0,
    completion_rate text NOT NULL DEFAULT '0%',
    challenges integer NOT NULL DEFAULT 0,
    certificates integer NOT NULL DEFAULT 0,
    circuits_run bigint NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS public.challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    course text NOT NULL,
    difficulty text NOT NULL DEFAULT 'Medium',
    points integer NOT NULL DEFAULT 100,
    submissions_count integer NOT NULL DEFAULT 0,
    pass_rate text NOT NULL DEFAULT '85%',
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name text NOT NULL,
    course_title text NOT NULL,
    issued_date text NOT NULL,
    status text NOT NULL DEFAULT 'Verified',
    certificate_code text UNIQUE NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CIRCUITS TABLE
CREATE TABLE IF NOT EXISTS public.circuits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    student_name text NOT NULL,
    engine text NOT NULL DEFAULT 'PennyLane',
    qubit_count integer NOT NULL DEFAULT 2,
    gate_count integer NOT NULL DEFAULT 5,
    status text NOT NULL DEFAULT 'Success',
    runtime_ms integer NOT NULL DEFAULT 12,
    executed_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. ERWIN INSIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.erwin_insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    affected_students_count integer NOT NULL DEFAULT 0,
    course text NOT NULL,
    concept text NOT NULL,
    risk_level text NOT NULL DEFAULT 'High',
    status text NOT NULL DEFAULT 'Action Required',
    recommended_action text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for all newly created tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erwin_insights ENABLE ROW LEVEL SECURITY;

-- Anonymous and Authenticated Read & Write Policies (Idempotent)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'Allow public read access on students') THEN
        CREATE POLICY "Allow public read access on students" ON public.students FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on students" ON public.students FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'courses' AND policyname = 'Allow public read access on courses') THEN
        CREATE POLICY "Allow public read access on courses" ON public.courses FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on courses" ON public.courses FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_overview' AND policyname = 'Allow public read access on teacher_overview') THEN
        CREATE POLICY "Allow public read access on teacher_overview" ON public.teacher_overview FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on teacher_overview" ON public.teacher_overview FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'challenges' AND policyname = 'Allow public read access on challenges') THEN
        CREATE POLICY "Allow public read access on challenges" ON public.challenges FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on challenges" ON public.challenges FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'Allow public read access on certificates') THEN
        CREATE POLICY "Allow public read access on certificates" ON public.certificates FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on certificates" ON public.certificates FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'circuits' AND policyname = 'Allow public read access on circuits') THEN
        CREATE POLICY "Allow public read access on circuits" ON public.circuits FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on circuits" ON public.circuits FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erwin_insights' AND policyname = 'Allow public read access on erwin_insights') THEN
        CREATE POLICY "Allow public read access on erwin_insights" ON public.erwin_insights FOR SELECT USING (true);
        CREATE POLICY "Allow public write access on erwin_insights" ON public.erwin_insights FOR ALL USING (true);
    END IF;
END $$;

-- SEED DATA FOR TEACHER OVERVIEW (0-DEFAULT)
INSERT INTO public.teacher_overview (id, active_courses, students, completion_rate, challenges, certificates, circuits_run)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 0, '0%', 0, 0, 0)
ON CONFLICT (id) DO UPDATE SET
    active_courses = EXCLUDED.active_courses,
    students = EXCLUDED.students,
    completion_rate = EXCLUDED.completion_rate,
    challenges = EXCLUDED.challenges,
    certificates = EXCLUDED.certificates,
    circuits_run = EXCLUDED.circuits_run;

