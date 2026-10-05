import { supabase } from '../../../lib/supabase';
import { 
  teacherOverview as fallbackOverview, 
  initialStudents as fallbackStudents, 
  initialCourses as fallbackCourses,
  erwinIntel as fallbackErwinIntel
} from '../data/portalData';

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  course: string;
  progress?: number;
  accuracy: number;
  circuitsRun: number;
  challengesCompleted: number;
  status: string;
  lastActive: string;
  misconceptionRisk: string;
  notes?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  level: string;
  status?: string;
  studentsCount: number;
  modulesCount: number;
  description: string;
  instructor: string;
  progress: number;
  tags: string[];
  phases?: any[];
}

export interface TeacherOverview {
  activeCourses: number;
  students: number;
  completionRate: string;
  challenges: number;
  certificates: number;
  circuitsRun: number;
}

export interface ErwinInsight {
  id: string;
  title: string;
  affectedStudentsCount: number;
  course: string;
  concept: string;
  riskLevel: string;
  status: string;
  recommendedAction: string;
}

// Runtime object exports so value imports in legacy/cached JS modules never throw
export const ErwinInsight = {};
export const Student = {};
export const Course = {};
export const TeacherOverview = {};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api/v1').replace(/\/+$/, '');

/**
 * Fetches Teacher Overview stats from Supabase / Backend API.
 */
export async function fetchTeacherOverview(): Promise<TeacherOverview> {
  // Query Supabase directly for exact dynamic table counts
  try {
    const [cRes, sRes, chRes, certRes, circRes] = await Promise.all([
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('challenges').select('*', { count: 'exact', head: true }),
      supabase.from('certificates').select('*', { count: 'exact', head: true }),
      supabase.from('circuits').select('*', { count: 'exact', head: true })
    ]);

    if (cRes.count !== null || sRes.count !== null) {
      const activeCourses = cRes.count || 0;
      const students = sRes.count || 0;
      const challenges = chRes.count || 0;
      const certificates = certRes.count || 0;
      const circuitsRun = circRes.count || 0;

      return {
        activeCourses,
        students,
        completionRate: students > 0 ? `${Math.min(100, Math.round((certificates / students) * 100))}%` : '0%',
        challenges,
        certificates,
        circuitsRun
      };
    }
  } catch (err) {
    console.warn('[Teacher API] Supabase exact count query failed:', err);
  }

  // Backend API query
  try {
    const res = await fetch(`${API_BASE_URL}/portal/teacher/overview`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.activeCourses !== undefined) {
        return data;
      }
    }
  } catch (e) {}

  return {
    activeCourses: 0,
    students: 0,
    completionRate: '0%',
    challenges: 0,
    certificates: 0,
    circuitsRun: 0
  };
}

/**
 * Fetches Students from Backend API / Supabase.
 */
export async function fetchStudents(): Promise<Student[]> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        avatar: item.avatar || undefined,
        course: item.course,
        progress: item.progress ?? (item.accuracy ? Math.round(item.accuracy * 0.9) : 80),
        accuracy: Number(item.accuracy) || 80,
        circuitsRun: item.circuits_run || 0,
        challengesCompleted: item.challenges_completed || 0,
        status: item.status || 'Active',
        lastActive: item.last_active || 'Recently',
        misconceptionRisk: item.misconception_risk || 'Low',
        notes: item.notes || '',
      }));
    }
  } catch (err) {
    console.warn('[Teacher API] Supabase error fetching students:', err);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/portal/teacher/students`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Fetches Courses from Supabase with fallback to Backend API.
 */
export async function fetchCourses(): Promise<Course[]> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        code: item.code,
        title: item.title,
        level: item.level,
        status: item.status || 'Published',
        studentsCount: item.students_count || 0,
        modulesCount: item.modules_count || 0,
        description: item.description || '',
        instructor: item.instructor || 'Dr. Erwin Schrödinger',
        progress: item.progress || 0,
        tags: item.tags || [],
        phases: item.phases || [],
      }));
    }
  } catch (err) {
    console.warn('[Teacher API] Supabase error fetching courses:', err);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/portal/teacher/courses`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Fetches Erwin Insights from Supabase or Backend API.
 */
export async function fetchErwinInsights(): Promise<ErwinInsight[]> {
  try {
    const { data, error } = await supabase
      .from('erwin_insights')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        title: item.title,
        affectedStudentsCount: item.affected_students_count || 0,
        course: item.course,
        concept: item.concept,
        riskLevel: item.risk_level || 'Medium',
        status: item.status || 'Active',
        recommendedAction: item.recommended_action || '',
      }));
    }
  } catch (err) {}

  try {
    const res = await fetch(`${API_BASE_URL}/portal/teacher/erwin-insights`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Adds a new Student to Supabase.
 */
export async function createStudent(student: Omit<Student, 'id'>): Promise<Student | null> {
  try {
    const { data, error } = await supabase
      .from('students')
      .insert([{
        name: student.name,
        email: student.email,
        avatar: student.avatar,
        course: student.course,
        accuracy: student.accuracy,
        circuits_run: student.circuitsRun,
        challenges_completed: student.challengesCompleted,
        status: student.status,
        last_active: student.lastActive,
        misconception_risk: student.misconceptionRisk,
        notes: student.notes
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('[Supabase API] Error creating student:', error?.message);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar,
      course: data.course,
      accuracy: Number(data.accuracy),
      circuitsRun: data.circuits_run,
      challengesCompleted: data.challenges_completed,
      status: data.status,
      lastActive: data.last_active,
      misconceptionRisk: data.misconception_risk,
      notes: data.notes,
    };
  } catch (err) {
    console.error('[Supabase API] Exception creating student:', err);
    return null;
  }
}
