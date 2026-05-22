/**
 * Minimal org-database types for `public` schema tables used by BI.
 * Full schema lives in the bitrixbot sync project.
 */
export type OrgJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: OrgJson | undefined }
  | OrgJson[];

export type OrgDatabase = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          bitrix_user_id: string;
          name: string;
          department_id: string | null;
          bitrix_login: string | null;
        };
        Insert: {
          id?: string;
          bitrix_user_id: string;
          name: string;
          department_id?: string | null;
          bitrix_login?: string | null;
        };
        Update: {
          id?: string;
          bitrix_user_id?: string;
          name?: string;
          department_id?: string | null;
          bitrix_login?: string | null;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          bitrix_department_id: string;
          name: string;
          parent_bitrix_department_id: string | null;
        };
        Insert: {
          id?: string;
          bitrix_department_id: string;
          name: string;
          parent_bitrix_department_id?: string | null;
        };
        Update: {
          id?: string;
          bitrix_department_id?: string;
          name?: string;
          parent_bitrix_department_id?: string | null;
        };
        Relationships: [];
      };
      org_resolved_hierarchy: {
        Row: {
          manager_bitrix_user_id: string;
          manager_name: string;
          department_id: string | null;
          department_name: string | null;
          is_active: boolean;
        };
        Insert: {
          manager_bitrix_user_id: string;
          manager_name: string;
          department_id?: string | null;
          department_name?: string | null;
          is_active?: boolean;
        };
        Update: {
          manager_bitrix_user_id?: string;
          manager_name?: string;
          department_id?: string | null;
          department_name?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      user_account_storage: {
        Row: {
          user_key: string;
          storage_key: string;
          payload: OrgJson;
          updated_at: string;
        };
        Insert: {
          user_key: string;
          storage_key: string;
          payload?: OrgJson;
          updated_at?: string;
        };
        Update: {
          user_key?: string;
          storage_key?: string;
          payload?: OrgJson;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
