/**
 * 穹弯 halfsphere - Supabase 数据库类型定义
 * 基于 migrations/20250516000001_init.sql 生成
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      providers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          display_name: string;
          api_key_encrypted: string;
          api_key_iv: string;
          api_key_tag: string;
          endpoint_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          display_name?: string;
          api_key_encrypted: string;
          api_key_iv: string;
          api_key_tag: string;
          endpoint_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          display_name?: string;
          api_key_encrypted?: string;
          api_key_iv?: string;
          api_key_tag?: string;
          endpoint_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "providers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      usage_snapshots: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          date: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          raw_data: Record<string, unknown> | null;
          synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          date: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          raw_data?: Record<string, unknown> | null;
          synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider_id?: string;
          date?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          raw_data?: Record<string, unknown> | null;
          synced_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_snapshots_provider_id_fkey";
            columns: ["provider_id"];
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_snapshots_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          monthly_limit_usd: number;
          warn_threshold: number;
          alert_threshold: number;
          email_alerts: boolean;
          telegram_chat_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          monthly_limit_usd?: number;
          warn_threshold?: number;
          alert_threshold?: number;
          email_alerts?: boolean;
          telegram_chat_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          monthly_limit_usd?: number;
          warn_threshold?: number;
          alert_threshold?: number;
          email_alerts?: boolean;
          telegram_chat_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      registration_requests: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          reason: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          display_name?: string | null;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_tiers: {
        Row: {
          user_id: string;
          tier: string;
          upgraded_at: string;
          permissions: unknown[] | null;
          granted_by: string | null;
        };
        Insert: {
          user_id: string;
          tier?: "guest" | "user" | "admin" | "owner";
          upgraded_at?: string;
          permissions?: unknown[] | null;
          granted_by?: string | null;
        };
        Update: {
          user_id?: string;
          tier?: "guest" | "user" | "admin" | "owner";
          upgraded_at?: string;
          permissions?: unknown[] | null;
          granted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_tiers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      network_nodes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          host_encrypted: string;
          host_iv: string;
          host_tag: string;
          port: number;
          protocol: string;
          region: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          host_encrypted: string;
          host_iv: string;
          host_tag: string;
          port?: number;
          protocol?: string;
          region?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          host_encrypted?: string;
          host_iv?: string;
          host_tag?: string;
          port?: number;
          protocol?: string;
          region?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "network_nodes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      network_snapshots: {
        Row: {
          id: string;
          node_id: string;
          user_id: string;
          latency_ms: number | null;
          status: string;
          checked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          user_id: string;
          latency_ms?: number | null;
          status?: string;
          checked_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          user_id?: string;
          latency_ms?: number | null;
          status?: string;
          checked_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "network_snapshots_node_id_fkey";
            columns: ["node_id"];
            referencedRelation: "network_nodes";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
