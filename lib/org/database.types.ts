/**
 * Minimal org-database types for `public` schema tables used by BI.
 * Full schema lives in the bitrixbot sync project.
 */
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
      };
      departments: {
        Row: {
          id: string;
          bitrix_department_id: string;
          name: string;
          parent_bitrix_department_id: string | null;
        };
      };
      org_resolved_hierarchy: {
        Row: {
          manager_bitrix_user_id: string;
          manager_name: string;
          department_id: string | null;
          department_name: string | null;
          is_active: boolean;
        };
      };
      user_account_storage: {
        Row: {
          user_key: string;
          storage_key: string;
          payload: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          user_key: string;
          storage_key: string;
          payload?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: {
          user_key?: string;
          storage_key?: string;
          payload?: Record<string, unknown>;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
