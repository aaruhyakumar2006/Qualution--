import { supabase } from '../../../lib/supabase';
import type { Database } from '../types/database.types';

export interface CommentAuthor {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  app_role?: string | null;
  is_verified?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  status: 'published' | 'flagged' | 'hidden' | 'deleted';
  created_at: string;
  updated_at: string;
  author: CommentAuthor;
}

export interface CreateCommentParams {
  postId: string;
  body: string;
  authorId: string;
}

/**
 * Strips HTML control/script tags and sanitizes comment body text.
 */
export function sanitizeCommentBody(input: string): string {
  if (!input) return '';
  // Strip script/html tags while preserving regular text
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Fetches all published comments for a given post joined with author profile metadata.
 */
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      post_id,
      author_id,
      body,
      status,
      created_at,
      updated_at,
      profiles:author_id (
        id,
        handle,
        display_name,
        avatar_url,
        app_role,
        is_verified
      )
    `)
    .eq('post_id', postId)
    .eq('status', 'published')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[PortalComments] Error fetching comments:', error.message);
    throw new Error(error.message || 'Failed to fetch comments');
  }

  if (!data) return [];

  return data.map((row: any) => {
    const profile = row.profiles || {};
    return {
      id: row.id,
      post_id: row.post_id,
      author_id: row.author_id,
      body: row.body,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: profile.id || row.author_id,
        handle: profile.handle || 'anonymous',
        display_name: profile.display_name || profile.handle || 'Quantum Scholar',
        avatar_url: profile.avatar_url || null,
        app_role: profile.app_role || 'student',
        is_verified: Boolean(profile.is_verified),
      },
    };
  });
}

/**
 * Creates and persists a new peer review comment.
 */
export async function createPostComment(params: CreateCommentParams): Promise<PostComment> {
  const { postId, body, authorId } = params;
  const sanitized = sanitizeCommentBody(body);

  if (!sanitized || sanitized.length === 0) {
    throw new Error('Comment body cannot be empty.');
  }
  if (sanitized.length > 5000) {
    throw new Error('Comment exceeds the maximum length of 5,000 characters.');
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      author_id: authorId,
      body: sanitized,
      status: 'published',
    })
    .select(`
      id,
      post_id,
      author_id,
      body,
      status,
      created_at,
      updated_at,
      profiles:author_id (
        id,
        handle,
        display_name,
        avatar_url,
        app_role,
        is_verified
      )
    `)
    .single();

  if (error) {
    console.error('[PortalComments] Failed to insert comment:', error);
    throw new Error(error.message || 'Failed to submit comment');
  }

  const profile = (data as any)?.profiles || {};
  return {
    id: data.id,
    post_id: data.post_id,
    author_id: data.author_id,
    body: data.body,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
    author: {
      id: profile.id || data.author_id,
      handle: profile.handle || 'author',
      display_name: profile.display_name || profile.handle || 'You',
      avatar_url: profile.avatar_url || null,
      app_role: profile.app_role || 'student',
      is_verified: Boolean(profile.is_verified),
    },
  };
}

/**
 * Deletes a comment by ID (guarded by RLS for author / moderator).
 */
export async function deletePostComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    throw new Error(error.message || 'Failed to delete comment');
  }
}

/**
 * Reports a comment to the moderation queue.
 */
export async function reportPostComment(
  commentId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  const sanitizedReason = sanitizeCommentBody(reason);
  if (!sanitizedReason || sanitizedReason.length < 3) {
    throw new Error('Please provide a descriptive reason for reporting this comment.');
  }

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      target_type: 'comment',
      target_id: commentId,
      reason: sanitizedReason,
      status: 'open',
    });

  if (error) {
    throw new Error(error.message || 'Failed to report comment');
  }
}
