import { supabase } from '../../../lib/supabase';
import type { Database } from '../types/database.types';
import type { PostSection } from '../types';
import { postFormSchema, normalizeTags, type PostFormInput } from '../validation/postSchema';

export type FeedPost = Database['public']['Views']['portal_posts_feed_view']['Row'];

export interface FetchFeedParams {
  section?: PostSection | null;
  tag?: string | null;
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit?: number;
}

export interface FetchFeedResult {
  posts: FeedPost[];
  nextCursor: {
    createdAt: string;
    id: string;
  } | null;
  hasMore: boolean;
}

/**
 * Keyset-paginated post feed query on (created_at, id)
 * Makes a single request joining author profile fields (Zero N+1)
 */
export async function fetchPostsFeed(params: FetchFeedParams = {}): Promise<FetchFeedResult> {
  const { section, tag, cursorCreatedAt, cursorId, limit = 10 } = params;

  // Try calling the keyset RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_portal_posts_feed', {
    p_section: section || null,
    p_tag: tag || null,
    p_cursor_created_at: cursorCreatedAt || null,
    p_cursor_id: cursorId || null,
    p_limit: limit + 1,
  });

  if (!rpcError && rpcData) {
    const hasMore = rpcData.length > limit;
    const posts = hasMore ? rpcData.slice(0, limit) : rpcData;
    const lastItem = posts.length > 0 ? posts[posts.length - 1] : null;

    return {
      posts: posts as FeedPost[],
      nextCursor: lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null,
      hasMore,
    };
  }

  // Fallback to view query if RPC is pending cache or unavailable
  let query = supabase
    .from('portal_posts_feed_view')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (section) {
    query = query.eq('section', section);
  }

  if (tag) {
    query = query.contains('tags', [tag.toLowerCase()]);
  }

  if (cursorCreatedAt) {
    query = query.lt('created_at', cursorCreatedAt);
  }

  const { data: viewData, error: viewError } = await query;

  if (viewError) {
    // Ultimate fallback to direct posts table if view cache is refreshing
    let fallbackQuery = supabase
      .from('posts')
      .select('*, profiles!author_id(*)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (section) {
      fallbackQuery = fallbackQuery.eq('section', section);
    }
    if (tag) {
      fallbackQuery = fallbackQuery.contains('tags', [tag.toLowerCase()]);
    }
    if (cursorCreatedAt) {
      fallbackQuery = fallbackQuery.lt('created_at', cursorCreatedAt);
    }

    const { data: fbData, error: fbError } = await fallbackQuery;
    if (fbError) throw fbError;

    const formatted: FeedPost[] = (fbData || []).map((row: any) => ({
      id: row.id,
      author_id: row.author_id,
      section: row.section,
      title: row.title,
      body: row.body,
      link_url: row.link_url,
      tags: row.tags || [],
      meta: row.meta || {},
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author_handle: row.profiles?.handle || 'anonymous',
      author_display_name: row.profiles?.display_name || 'Quantum Pioneer',
      author_avatar_url: row.profiles?.avatar_url || null,
      author_is_verified: !!row.profiles?.is_verified,
      author_role: row.profiles?.role || 'student',
    }));

    const hasMore = formatted.length > limit;
    const posts = hasMore ? formatted.slice(0, limit) : formatted;
    const lastItem = posts.length > 0 ? posts[posts.length - 1] : null;

    return {
      posts,
      nextCursor: lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null,
      hasMore,
    };
  }

  const postsList = (viewData || []) as FeedPost[];
  const hasMore = postsList.length > limit;
  const posts = hasMore ? postsList.slice(0, limit) : postsList;
  const lastItem = posts.length > 0 ? posts[posts.length - 1] : null;

  return {
    posts,
    nextCursor: lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null,
    hasMore,
  };
}

/**
 * Fetch a single post by ID along with the author's public profile fields
 */
export async function fetchPostById(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from('portal_posts_feed_view')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!error && data) {
    return data as FeedPost;
  }

  // Fallback to table query
  const { data: rawPost, error: rawError } = await supabase
    .from('posts')
    .select('*, profiles!author_id(*)')
    .eq('id', id)
    .maybeSingle();

  if (rawError || !rawPost) {
    return null;
  }

  const p: any = rawPost;
  return {
    id: p.id,
    author_id: p.author_id,
    section: p.section,
    title: p.title,
    body: p.body,
    link_url: p.link_url,
    tags: p.tags || [],
    meta: p.meta || {},
    status: p.status,
    created_at: p.created_at,
    updated_at: p.updated_at,
    author_handle: p.profiles?.handle || 'anonymous',
    author_display_name: p.profiles?.display_name || 'Quantum Pioneer',
    author_avatar_url: p.profiles?.avatar_url || null,
    author_is_verified: !!p.profiles?.is_verified,
    author_role: p.profiles?.role || 'student',
  };
}

/**
 * Create a new community post (login required)
 */
export async function createPost(input: PostFormInput): Promise<FeedPost> {
  // 1. Zod client-side validation
  const validated = postFormSchema.parse(input);

  // 2. Auth session check
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('You must be signed in to create a post.');
  }

  const authorId = authData.user.id;
  const cleanTags = normalizeTags(validated.tags);

  // 3. Database insertion
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      section: validated.section,
      title: validated.title.trim(),
      body: validated.body.trim(),
      link_url: validated.link_url ? validated.link_url.trim() : null,
      tags: cleanTags,
      meta: validated.meta || {},
      status: 'published',
    })
    .select()
    .single();

  if (error) {
    // Map rate limit or server constraint errors to user-friendly messages
    if (error.code === 'PT429' || error.code === 'P0002' || error.message.includes('Rate limit exceeded')) {
      throw new Error('Rate limit reached: You can create up to 10 posts per hour. Please wait before posting again.');
    }
    if (error.message.includes('chk_research_post_paper_url')) {
      throw new Error('Research posts require a valid Paper URL starting with http:// or https://');
    }
    throw error;
  }

  // Retrieve joined post
  const fullPost = await fetchPostById(data.id);
  if (!fullPost) {
    throw new Error('Post created, but unable to load post view.');
  }
  return fullPost;
}

/**
 * Update an existing post. Non-moderators can only update their own content
 * and cannot alter author, status, or created_at.
 */
export async function updatePost(
  postId: string,
  input: Partial<PostFormInput>
): Promise<FeedPost> {
  const updatePayload: Record<string, any> = {};

  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.body !== undefined) updatePayload.body = input.body.trim();
  if (input.link_url !== undefined) updatePayload.link_url = input.link_url ? input.link_url.trim() : null;
  if (input.tags !== undefined) updatePayload.tags = normalizeTags(input.tags);
  if (input.meta !== undefined) updatePayload.meta = input.meta;

  const { data, error } = await supabase
    .from('posts')
    .update(updatePayload)
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    if (error.code === 'P0001') {
      throw new Error('Permission denied: You cannot alter post status or author identity.');
    }
    throw error;
  }

  const updated = await fetchPostById(data.id);
  if (!updated) {
    throw new Error('Post updated, but unable to load post view.');
  }
  return updated;
}

/**
 * Soft-delete a post (marks status as 'deleted' via security-definer RPC or direct update)
 * Keeps the row in PostgreSQL for moderation audit trails and report integrity.
 */
export async function deletePost(postId: string): Promise<boolean> {
  // 1. Try invoking the security-definer soft_delete_post RPC function
  const { error: rpcError } = await (supabase.rpc as any)('soft_delete_post', {
    p_post_id: postId,
  });

  if (!rpcError) {
    return true;
  }

  // 2. Fallback to direct update if RPC is pending cache
  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'deleted' })
    .eq('id', postId);

  if (updateError) {
    throw updateError;
  }
  return true;
}
