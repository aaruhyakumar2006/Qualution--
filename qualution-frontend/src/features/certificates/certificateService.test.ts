import { describe, it, expect } from 'vitest';
import {
  evaluateCurriculumGraduation,
  getOrCreateStudentCertificate,
  BEGINNER_LESSON_IDS,
  INTERMEDIATE_LESSON_IDS,
  ADVANCED_LESSON_IDS
} from './certificateService';

describe('3-Tier Curriculum Graduation & Certificate Minting', () => {
  it('identifies incomplete status if only Beginner tier is completed', () => {
    const completedLessons = [...BEGINNER_LESSON_IDS];

    const status = evaluateCurriculumGraduation(completedLessons);

    expect(status.beginner.isComplete).toBe(true);
    expect(status.intermediate.isComplete).toBe(false);
    expect(status.advanced.isComplete).toBe(false);
    expect(status.isGraduated).toBe(false);
    expect(status.totalCompleted).toBe(4);
    expect(status.totalRequired).toBe(12);
    expect(status.completionPercentage).toBe(33);

    // Certificate generation must return null when not graduated
    const cert = getOrCreateStudentCertificate('Mario Explorer', 'mario@qualution.ai', 88, 'B+', false);
    expect(cert).toBeNull();
  });

  it('identifies incomplete status if Beginner and Intermediate are done but Advanced is missing', () => {
    const completedLessons = [...BEGINNER_LESSON_IDS, ...INTERMEDIATE_LESSON_IDS];

    const status = evaluateCurriculumGraduation(completedLessons);

    expect(status.beginner.isComplete).toBe(true);
    expect(status.intermediate.isComplete).toBe(true);
    expect(status.advanced.isComplete).toBe(false);
    expect(status.isGraduated).toBe(false);
    expect(status.completionPercentage).toBe(67);

    // Certificate generation must return null
    const cert = getOrCreateStudentCertificate('Luigi Entangler', 'luigi@qualution.ai', 92, 'A', false);
    expect(cert).toBeNull();
  });

  it('generates certificate only when ALL 3 tiers (Beginner, Intermediate, Advanced) are completed', () => {
    const allLessonIds = [
      ...BEGINNER_LESSON_IDS,
      ...INTERMEDIATE_LESSON_IDS,
      ...ADVANCED_LESSON_IDS
    ];

    const status = evaluateCurriculumGraduation(allLessonIds);

    expect(status.beginner.isComplete).toBe(true);
    expect(status.intermediate.isComplete).toBe(true);
    expect(status.advanced.isComplete).toBe(true);
    expect(status.isGraduated).toBe(true);
    expect(status.completionPercentage).toBe(100);


    // Verify localStorage persistence for simulated full completion
    if (typeof window !== 'undefined') {
      localStorage.setItem('qualution_completed_lessons', JSON.stringify(allLessonIds));
    }

    // Certificate should now be minted and valid
    const cert = getOrCreateStudentCertificate('Peach Master', 'peach@qualution.ai', 98, 'A+', false);
    expect(cert).not.toBeNull();
    expect(cert?.recipientName).toBe('Peach Master');
    expect(cert?.verificationHash).toBeDefined();
    expect(cert?.verifiedSkills.length).toBeGreaterThan(0);
  });

  it('allows forced eligibility for external verification or demo lookups', () => {
    const cert = getOrCreateStudentCertificate(
      'Demo Student',
      'demo@qualution.ai',
      95,
      'A+',
      true
    );
    expect(cert).not.toBeNull();
    expect(cert?.recipientName).toBe('Demo Student');
  });
});

