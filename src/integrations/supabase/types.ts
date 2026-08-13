export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          module: string
          record_ref: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          record_ref?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          record_ref?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      dispensing_items: {
        Row: {
          batch_id: string
          batch_number: string
          dispensing_id: string
          id: string
          medicine_id: string
          quantity: number
        }
        Insert: {
          batch_id: string
          batch_number: string
          dispensing_id: string
          id?: string
          medicine_id: string
          quantity: number
        }
        Update: {
          batch_id?: string
          batch_number?: string
          dispensing_id?: string
          id?: string
          medicine_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispensing_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensing_items_dispensing_id_fkey"
            columns: ["dispensing_id"]
            isOneToOne: false
            referencedRelation: "dispensings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensing_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_summary"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "dispensing_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      dispensings: {
        Row: {
          code: string
          created_at: string
          dispensed_at: string
          dispensed_by: string | null
          dispensed_by_name: string | null
          id: string
          notes: string | null
          patient_id: string | null
          prescription_id: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          dispensed_at?: string
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          prescription_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          dispensed_at?: string
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          prescription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispensings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensings_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_batches: {
        Row: {
          batch_number: string
          created_at: string
          current_quantity: number
          date_received: string
          expiry_date: string
          id: string
          manufacturing_date: string | null
          medicine_id: string
          purchase_price: number | null
          quantity_received: number
          storage_location: string | null
          supplier_id: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          current_quantity?: number
          date_received?: string
          expiry_date: string
          id?: string
          manufacturing_date?: string | null
          medicine_id: string
          purchase_price?: number | null
          quantity_received?: number
          storage_location?: string | null
          supplier_id?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          current_quantity?: number
          date_received?: string
          expiry_date?: string
          id?: string
          manufacturing_date?: string | null
          medicine_id?: string
          purchase_price?: number | null
          quantity_received?: number
          storage_location?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_summary"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      medicines: {
        Row: {
          brand: string | null
          category_id: string | null
          code: string
          created_at: string
          dosage_form: string
          generic_name: string | null
          id: string
          is_active: boolean
          name: string
          prescription_required: boolean
          reorder_level: number
          storage_location: string | null
          strength: string | null
          unit: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          dosage_form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          prescription_required?: boolean
          reorder_level?: number
          storage_location?: string | null
          strength?: string | null
          unit?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          dosage_form?: string
          generic_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          prescription_required?: boolean
          reorder_level?: number
          storage_location?: string | null
          strength?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "medicine_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          clinic_reference: string | null
          code: string
          contact_number: string | null
          created_at: string
          gender: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          age?: number | null
          clinic_reference?: string | null
          code?: string
          contact_number?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          age?: number | null
          clinic_reference?: string | null
          code?: string
          contact_number?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          dosage_instructions: string | null
          duration: string | null
          id: string
          medicine_id: string
          prescribed_quantity: number
          prescription_id: string
        }
        Insert: {
          dosage_instructions?: string | null
          duration?: string | null
          id?: string
          medicine_id: string
          prescribed_quantity: number
          prescription_id: string
        }
        Update: {
          dosage_instructions?: string | null
          duration?: string | null
          id?: string
          medicine_id?: string
          prescribed_quantity?: number
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_summary"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "prescription_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          code: string
          created_at: string
          doctor_name: string
          id: string
          notes: string | null
          patient_id: string
          prescription_date: string
        }
        Insert: {
          code?: string
          created_at?: string
          doctor_name: string
          id?: string
          notes?: string | null
          patient_id: string
          prescription_date?: string
        }
        Update: {
          code?: string
          created_at?: string
          doctor_name?: string
          id?: string
          notes?: string | null
          patient_id?: string
          prescription_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          batch_id: string | null
          batch_number: string
          expiry_date: string
          id: string
          manufacturing_date: string | null
          medicine_id: string
          purchase_id: string
          purchase_price: number | null
          quantity: number
        }
        Insert: {
          batch_id?: string | null
          batch_number: string
          expiry_date: string
          id?: string
          manufacturing_date?: string | null
          medicine_id: string
          purchase_id: string
          purchase_price?: number | null
          quantity: number
        }
        Update: {
          batch_id?: string | null
          batch_number?: string
          expiry_date?: string
          id?: string
          manufacturing_date?: string | null
          medicine_id?: string
          purchase_id?: string
          purchase_price?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_summary"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "purchase_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          invoice_number: string | null
          notes: string | null
          purchase_date: string
          received_by: string | null
          received_by_name: string | null
          reference: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string
          received_by?: string | null
          received_by_name?: string | null
          reference?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string
          received_by?: string | null
          received_by_name?: string | null
          reference?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          default_reorder_level: number
          expiry_notifications: boolean
          expiry_warning_days: number
          id: boolean
          low_stock_notifications: boolean
          pharmacy_name: string
          updated_at: string
        }
        Insert: {
          default_reorder_level?: number
          expiry_notifications?: boolean
          expiry_warning_days?: number
          id?: boolean
          low_stock_notifications?: boolean
          pharmacy_name?: string
          updated_at?: string
        }
        Update: {
          default_reorder_level?: number
          expiry_notifications?: boolean
          expiry_warning_days?: number
          id?: boolean
          low_stock_notifications?: boolean
          pharmacy_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_transactions: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string
          id: string
          medicine_id: string
          new_quantity: number
          previous_quantity: number
          quantity_change: number
          reason: string | null
          txn_type: Database["public"]["Enums"]["stock_txn_type"]
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          id?: string
          medicine_id: string
          new_quantity: number
          previous_quantity: number
          quantity_change: number
          reason?: string | null
          txn_type: Database["public"]["Enums"]["stock_txn_type"]
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          id?: string
          medicine_id?: string
          new_quantity?: number
          previous_quantity?: number
          quantity_change?: number
          reason?: string | null
          txn_type?: Database["public"]["Enums"]["stock_txn_type"]
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock_summary"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "stock_transactions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      medicine_stock_summary: {
        Row: {
          active_batches: number | null
          expired_quantity: number | null
          medicine_id: string | null
          next_expiry: string | null
          total_quantity: number | null
          usable_quantity: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_batch_id: string
          p_delta: number
          p_notes: string
          p_reason: string
        }
        Returns: string
      }
      current_user_name: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      record_dispensing: {
        Args: {
          p_items: Json
          p_notes: string
          p_patient_id: string
          p_prescription_id: string
        }
        Returns: string
      }
      record_purchase: {
        Args: {
          p_invoice_number: string
          p_items: Json
          p_notes: string
          p_purchase_date: string
          p_supplier_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "pharmacist" | "assistant"
      stock_txn_type:
        | "received"
        | "dispensed"
        | "damaged"
        | "expired"
        | "returned"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pharmacist", "assistant"],
      stock_txn_type: [
        "received",
        "dispensed",
        "damaged",
        "expired",
        "returned",
        "adjustment",
      ],
    },
  },
} as const
