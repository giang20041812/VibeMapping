export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CustomerStatus = 'active' | 'inactive' | 'pending' | 'locked';

export interface Database {
  public: {
    Tables: {
      customer_categories: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          customer_code: string;
          full_name: string;
          category_id: string | null;
          email: string | null;
          phone: string | null;
          tax_id: string | null;
          address: string | null;
          city: string | null;
          status: CustomerStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_code: string;
          full_name: string;
          category_id?: string | null;
          email?: string | null;
          phone?: string | null;
          tax_id?: string | null;
          address?: string | null;
          city?: string | null;
          status?: CustomerStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_code?: string;
          full_name?: string;
          category_id?: string | null;
          email?: string | null;
          phone?: string | null;
          tax_id?: string | null;
          address?: string | null;
          city?: string | null;
          status?: CustomerStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      customer_status: CustomerStatus;
    };
  };
}

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type CustomerCategoryRow = Database['public']['Tables']['customer_categories']['Row'];
