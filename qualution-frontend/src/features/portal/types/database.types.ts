export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRole = 'student' | 'researcher' | 'teacher' | 'professional';
export type AppRole = 'user' | 'moderator' | 'admin';
export type PostSection = 'courses' | 'news' | 'research' | 'events' | 'qualution';
export type PostStatus = 'pending' | 'published' | 'removed' | 'deleted';
export type OpportunityKind = 'internship' | 'fellowship' | 'hackathon' | 'job' | 'scholarship' | 'other';
export type OpportunityStatus = 'pending' | 'published' | 'expired' | 'removed';
export type CommentStatus = 'published' | 'removed';
export type ReportTargetType = 'post' | 'comment' | 'opportunity' | 'profile';
export type ReportStatus = 'open' | 'actioned' | 'dismissed';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string;
          role: ProfileRole;
          institution: string | null;
          bio: string | null;
          interests: string[];
          links: Json;
          avatar_url: string | null;
          is_verified: boolean;
          app_role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name: string;
          role?: ProfileRole;
          institution?: string | null;
          bio?: string | null;
          interests?: string[];
          links?: Json;
          avatar_url?: string | null;
          is_verified?: boolean;
          app_role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          display_name?: string;
          role?: ProfileRole;
          institution?: string | null;
          bio?: string | null;
          interests?: string[];
          links?: Json;
          avatar_url?: string | null;
          is_verified?: boolean;
          app_role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          section: PostSection;
          title: string;
          body: string;
          link_url: string | null;
          tags: string[];
          meta: Json;
          status: PostStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          section: PostSection;
          title: string;
          body: string;
          link_url?: string | null;
          tags?: string[];
          meta?: Json;
          status?: PostStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          section?: PostSection;
          title?: string;
          body?: string;
          link_url?: string | null;
          tags?: string[];
          meta?: Json;
          status?: PostStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      opportunities: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          organisation: string;
          kind: OpportunityKind;
          description: string;
          apply_url: string;
          location: string | null;
          deadline: string | null;
          status: OpportunityStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          organisation: string;
          kind: OpportunityKind;
          description: string;
          apply_url: string;
          location?: string | null;
          deadline?: string | null;
          status?: OpportunityStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          organisation?: string;
          kind?: OpportunityKind;
          description?: string;
          apply_url?: string;
          location?: string | null;
          deadline?: string | null;
          status?: OpportunityStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      reactions: {
        Row: {
          user_id: string;
          post_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          kind: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          status: CommentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          status?: CommentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          body?: string;
          status?: CommentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: string;
          status: ReportStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: string;
          status?: ReportStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: ReportTargetType;
          target_id?: string;
          reason?: string;
          status?: ReportStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      portal_telemetry_events: {
        Row: {
          id: string;
          session_id: string | null;
          event_type: string;
          event_payload: Json;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          event_type: string;
          event_payload?: Json;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          event_type?: string;
          event_payload?: Json;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      portal_telemetry_summary: {
        Row: {
          event_type: string;
          event_date: string;
          event_count: number;
        };
      };
      portal_posts_feed_view: {
        Row: {
          id: string;
          author_id: string;
          section: PostSection;
          title: string;
          body: string;
          link_url: string | null;
          tags: string[];
          meta: Json;
          status: PostStatus;
          created_at: string;
          updated_at: string;
          author_handle: string;
          author_display_name: string;
          author_avatar_url: string | null;
          author_is_verified: boolean;
          author_role: ProfileRole;
        };
      };
    };
    Functions: {
      is_moderator: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      expire_opportunities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cleanup_expired_telemetry_events: {
        Args: { retention_days?: number };
        Returns: number;
      };
      soft_delete_post: {
        Args: { p_post_id: string };
        Returns: boolean;
      };
      get_portal_posts_feed: {
        Args: {
          p_section?: PostSection | null;
          p_tag?: string | null;
          p_cursor_created_at?: string | null;
          p_cursor_id?: string | null;
          p_limit?: number;
        };
        Returns: {
          id: string;
          author_id: string;
          section: PostSection;
          title: string;
          body: string;
          link_url: string | null;
          tags: string[];
          meta: Json;
          status: PostStatus;
          created_at: string;
          updated_at: string;
          author_handle: string;
          author_display_name: string;
          author_avatar_url: string | null;
          author_is_verified: boolean;
          author_role: ProfileRole;
        }[];
      };
    };
    Enums: {
      profile_role: ProfileRole;
      app_role: AppRole;
      post_section: PostSection;
      post_status: PostStatus;
      opportunity_kind: OpportunityKind;
      opportunity_status: OpportunityStatus;
      comment_status: CommentStatus;
      report_target_type: ReportTargetType;
      report_status: ReportStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
