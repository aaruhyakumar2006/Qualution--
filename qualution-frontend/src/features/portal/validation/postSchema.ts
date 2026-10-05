import { z } from 'zod';
import type { PostSection } from '../types';

/**
 * Regex for permitted tag characters: lowercase alphanumeric, hyphens, and underscores.
 */
export const TAG_REGEX = /^[a-z0-9_\-]+$/;

/**
 * Normalizes an array of raw tag strings:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips empty strings
 * - Deduplicates
 * - Limits to max 5 items
 */
export function normalizeTags(rawTags: string[] | string): string[] {
  const list = Array.isArray(rawTags)
    ? rawTags
    : rawTags.split(',').map((t) => t.trim());

  const cleaned = list
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && TAG_REGEX.test(t))
    .map((t) => (t.length > 30 ? t.slice(0, 30) : t));

  return Array.from(new Set(cleaned)).slice(0, 5);
}

/**
 * Validates whether a single tag string meets the rules.
 */
export function isValidTag(tag: string): boolean {
  const trimmed = tag.trim().toLowerCase();
  return trimmed.length >= 1 && trimmed.length <= 30 && TAG_REGEX.test(trimmed);
}

export const postSectionEnum = z.enum([
  'courses',
  'news',
  'research',
  'events',
  'qualution',
]);

const urlSchema = z
  .string()
  .trim()
  .refine(
    (val) => !val || /^https?:\/\/.+/i.test(val),
    { message: 'URL must start with http:// or https://' }
  )
  .optional()
  .or(z.literal(''));

export const researchMetaSchema = z.object({
  paper_url: z
    .string()
    .trim()
    .min(1, 'Paper URL is required for research publications')
    .refine((val) => /^https?:\/\/.+/i.test(val), {
      message: 'Paper URL must start with http:// or https://',
    }),
  abstract: z.string().trim().max(5000, 'Abstract cannot exceed 5000 characters').optional().or(z.literal('')),
});

export const basePostSchema = z.object({
  section: postSectionEnum,
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(300, 'Title cannot exceed 300 characters'),
  body: z
    .string()
    .trim()
    .min(5, 'Post body must be at least 5 characters')
    .max(50000, 'Post body cannot exceed 50,000 characters'),
  link_url: urlSchema,
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Tag must have at least 1 character')
        .max(30, 'Tag cannot exceed 30 characters')
        .regex(TAG_REGEX, 'Tags can only contain lowercase letters, numbers, hyphens, and underscores')
    )
    .max(5, 'You can add at most 5 tags')
    .default([]),
  meta: z.record(z.string(), z.any()).optional().default({}),
});

/**
 * Complete Post creation and editing schema with dynamic research section requirement.
 */
export const postFormSchema = basePostSchema.superRefine((data, ctx) => {
  if (data.section === 'research') {
    const paperUrl = data.meta?.paper_url;
    if (!paperUrl || typeof paperUrl !== 'string' || !/^https?:\/\/.+/i.test(paperUrl.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Research posts require a valid Paper URL starting with http:// or https://',
        path: ['meta', 'paper_url'],
      });
    }
  }
});

export type PostFormInput = z.infer<typeof postFormSchema>;
