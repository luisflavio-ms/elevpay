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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checkout_price_variants: {
        Row: {
          amount: number
          checkout_id: string
          created_at: string
          id: string
          public_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_id: string
          created_at?: string
          id?: string
          public_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_id?: string
          created_at?: string
          id?: string
          public_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_price_variants_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_price_variants_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "public_checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          active: boolean
          amount: number
          benefits: Json
          blocks: Json
          button_text: string
          conversion: number
          created_at: string
          guarantee: string
          headline: string
          id: string
          image: string | null
          name: string
          order_bump_id: string | null
          payment_methods: Json
          pixel_google: string | null
          pixel_meta: string | null
          primary_color: string
          product_id: string | null
          public_id: string
          redirect_url: string | null
          revenue: number
          scarcity_timer_minutes: number
          secure_seal: boolean
          subheadline: string
          testimonials: Json
          updated_at: string
          urgency_message: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          active?: boolean
          amount?: number
          benefits?: Json
          blocks?: Json
          button_text?: string
          conversion?: number
          created_at?: string
          guarantee?: string
          headline?: string
          id?: string
          image?: string | null
          name: string
          order_bump_id?: string | null
          payment_methods?: Json
          pixel_google?: string | null
          pixel_meta?: string | null
          primary_color?: string
          product_id?: string | null
          public_id?: string
          redirect_url?: string | null
          revenue?: number
          scarcity_timer_minutes?: number
          secure_seal?: boolean
          subheadline?: string
          testimonials?: Json
          updated_at?: string
          urgency_message?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          benefits?: Json
          blocks?: Json
          button_text?: string
          conversion?: number
          created_at?: string
          guarantee?: string
          headline?: string
          id?: string
          image?: string | null
          name?: string
          order_bump_id?: string | null
          payment_methods?: Json
          pixel_google?: string | null
          pixel_meta?: string | null
          primary_color?: string
          product_id?: string | null
          public_id?: string
          redirect_url?: string | null
          revenue?: number
          scarcity_timer_minutes?: number
          secure_seal?: boolean
          subheadline?: string
          testimonials?: Json
          updated_at?: string
          urgency_message?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      order_bumps: {
        Row: {
          compare_at_price: number | null
          created_at: string
          description: string
          id: string
          price: number
          product_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          description?: string
          id?: string
          price?: number
          product_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          description?: string
          id?: string
          price?: number
          product_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          abacate_billing_id: string | null
          amount: number
          checkout_id: string | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          external_id: string | null
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"]
          pix_copy_paste: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          product_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          abacate_billing_id?: string | null
          amount?: number
          checkout_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          abacate_billing_id?: string | null
          amount?: number
          checkout_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          pix_copy_paste?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "public_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          delivery_url: string | null
          description: string
          id: string
          image: string | null
          name: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_url?: string | null
          description?: string
          id?: string
          image?: string | null
          name: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_url?: string | null
          description?: string
          id?: string
          image?: string | null
          name?: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notifications_enabled: boolean
          state: string | null
          support_email: string | null
          support_social: string | null
          support_whatsapp: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          notifications_enabled?: boolean
          state?: string | null
          support_email?: string | null
          support_social?: string | null
          support_whatsapp?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notifications_enabled?: boolean
          state?: string | null
          support_email?: string | null
          support_social?: string | null
          support_whatsapp?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          order_id: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          order_id?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          order_id?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          net_amount: number
          order_id: string
          paid_at: string
          product_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          order_id: string
          paid_at?: string
          product_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          order_id?: string
          paid_at?: string
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      webhook_configs: {
        Row: {
          active: boolean
          api_token: string | null
          created_at: string
          events: Database["public"]["Enums"]["webhook_event"][]
          headers: Json
          id: string
          name: string
          product_ids: string[]
          provider: Database["public"]["Enums"]["webhook_provider"]
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          api_token?: string | null
          created_at?: string
          events?: Database["public"]["Enums"]["webhook_event"][]
          headers?: Json
          id?: string
          name: string
          product_ids?: string[]
          provider?: Database["public"]["Enums"]["webhook_provider"]
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          api_token?: string | null
          created_at?: string
          events?: Database["public"]["Enums"]["webhook_event"][]
          headers?: Json
          id?: string
          name?: string
          product_ids?: string[]
          provider?: Database["public"]["Enums"]["webhook_provider"]
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id: string
          payload: Json
          response: Json | null
          status_code: number | null
          success: boolean
          user_id: string
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          response?: Json | null
          status_code?: number | null
          success?: boolean
          user_id: string
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          response?: Json | null
          status_code?: number | null
          success?: boolean
          user_id?: string
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_checkouts: {
        Row: {
          active: boolean | null
          amount: number | null
          benefits: Json | null
          blocks: Json | null
          button_text: string | null
          guarantee: string | null
          headline: string | null
          id: string | null
          image: string | null
          name: string | null
          order_bump_id: string | null
          payment_methods: Json | null
          primary_color: string | null
          product_id: string | null
          public_id: string | null
          scarcity_timer_minutes: number | null
          secure_seal: boolean | null
          subheadline: string | null
          testimonials: Json | null
          urgency_message: string | null
        }
        Insert: {
          active?: boolean | null
          amount?: number | null
          benefits?: Json | null
          blocks?: Json | null
          button_text?: string | null
          guarantee?: string | null
          headline?: string | null
          id?: string | null
          image?: string | null
          name?: string | null
          order_bump_id?: string | null
          payment_methods?: Json | null
          primary_color?: string | null
          product_id?: string | null
          public_id?: string | null
          scarcity_timer_minutes?: number | null
          secure_seal?: boolean | null
          subheadline?: string | null
          testimonials?: Json | null
          urgency_message?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number | null
          benefits?: Json | null
          blocks?: Json | null
          button_text?: string | null
          guarantee?: string | null
          headline?: string | null
          id?: string | null
          image?: string | null
          name?: string | null
          order_bump_id?: string | null
          payment_methods?: Json | null
          primary_color?: string | null
          product_id?: string | null
          public_id?: string | null
          scarcity_timer_minutes?: number | null
          secure_seal?: boolean | null
          subheadline?: string | null
          testimonials?: Json | null
          urgency_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_short_id: { Args: { len?: number }; Returns: string }
      get_public_checkout: { Args: { p_public_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_safe_public_url: { Args: { u: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status: "aprovado" | "pendente" | "recusado" | "reembolsado"
      payment_method: "pix" | "cartao" | "boleto"
      product_type: "digital" | "fisico" | "assinatura"
      webhook_event:
        | "payment.approved"
        | "payment.pending"
        | "payment.refused"
        | "payment.refunded"
        | "checkout.created"
      webhook_provider: "utmify" | "custom" | "zapier" | "make"
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
      app_role: ["admin", "user"],
      order_status: ["aprovado", "pendente", "recusado", "reembolsado"],
      payment_method: ["pix", "cartao", "boleto"],
      product_type: ["digital", "fisico", "assinatura"],
      webhook_event: [
        "payment.approved",
        "payment.pending",
        "payment.refused",
        "payment.refunded",
        "checkout.created",
      ],
      webhook_provider: ["utmify", "custom", "zapier", "make"],
    },
  },
} as const
