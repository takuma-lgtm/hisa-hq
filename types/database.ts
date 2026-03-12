// =============================================================================
// HISA Matcha CRM — Database Types
// Hand-authored to match migrations 001 + 003_schema_v2.sql.
//
// When you have a connected Supabase project, replace this with:
//   pnpm dlx supabase gen types typescript --project-id <ref> > types/database.ts
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---------------------------------------------------------------------------
// Convenience type aliases
// ---------------------------------------------------------------------------
export type UserRole           = Database['public']['Enums']['user_role']
export type CafeType           = Database['public']['Enums']['cafe_type_enum']
export type CafeSegment        = Database['public']['Enums']['cafe_segment_enum']
export type MatchaExperience   = Database['public']['Enums']['matcha_experience_enum']
export type CustomerStatus     = Database['public']['Enums']['customer_status_enum']
export type OpportunityStage   = Database['public']['Enums']['opportunity_stage_enum']
export type InstagramStatus    = Database['public']['Enums']['instagram_status_enum']
export type SampleResult       = Database['public']['Enums']['sample_result_enum']
export type SampleFeedback     = Database['public']['Enums']['sample_feedback_enum']
export type PaymentTerms       = Database['public']['Enums']['payment_terms_enum']
export type QuoteStatus        = Database['public']['Enums']['quote_status_enum']
export type PaymentStatus      = Database['public']['Enums']['payment_status_enum']
export type NotificationType   = Database['public']['Enums']['notification_type_enum']
export type CallType           = Database['public']['Enums']['call_type_enum']
export type CallOutcome        = Database['public']['Enums']['call_outcome_enum']
export type LeadStage          = Database['public']['Enums']['lead_stage_enum']

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new_lead:     'New Lead',
  contacted:    'Contacted',
  replied:      'Replied',
  qualified:    'Qualified',
  handed_off:   'Handed Off',
  disqualified: 'Disqualified',
}

// Row shorthand types
export type Profile               = Database['public']['Tables']['profiles']['Row']
export type Customer              = Database['public']['Tables']['customers']['Row']
export type Opportunity           = Database['public']['Tables']['opportunities']['Row']
export type InstagramLog          = Database['public']['Tables']['instagram_logs']['Row']
export type SampleBatch           = Database['public']['Tables']['sample_batches']['Row']
export type SampleBatchItem       = Database['public']['Tables']['sample_batch_items']['Row']
export type Product               = Database['public']['Tables']['products']['Row']
export type Quotation             = Database['public']['Tables']['quotations']['Row']
export type Invoice               = Database['public']['Tables']['invoices']['Row']
export type RecurringOrder        = Database['public']['Tables']['recurring_orders']['Row']
export type Notification          = Database['public']['Tables']['notifications']['Row']
export type CallLog               = Database['public']['Tables']['call_logs']['Row']
export type OpportunityProposal   = Database['public']['Tables']['opportunity_proposals']['Row']
export type OpportunityProposalItem = Database['public']['Tables']['opportunity_proposal_items']['Row']

// JSONB payload shapes (legacy — new code uses normalized tables)
export interface ProductSent {
  product_id: string
  customer_facing_name: string
  qty_g: number
}
export interface QuotationLineItem {
  product_id: string
  name: string
  qty_kg: number
  price_per_kg: number
  subtotal: number
}
export interface RecurringOrderLineItem {
  product_id: string
  name: string
  qty_kg: number
  price_per_kg: number
}

// Joined types used in components
export interface OpportunityWithCustomer extends Opportunity {
  customer: Pick<Customer, 'cafe_name' | 'city' | 'country'>
}

export interface OpportunityFull extends Opportunity {
  customer: Customer
  assigned_profile: Pick<Profile, 'id' | 'name' | 'role'> | null
  handoff_profile: Pick<Profile, 'id' | 'name'> | null
}

export interface CallLogWithProfile extends CallLog {
  logged_by_profile: Pick<Profile, 'name'>
}

export interface ProposalWithItems extends OpportunityProposal {
  items: (OpportunityProposalItem & {
    product: Pick<Product, 'customer_facing_product_name' | 'supplier_product_name'>
  })[]
}

export interface SampleBatchWithItems extends SampleBatch {
  items: SampleBatchItem[]
}

// ---------------------------------------------------------------------------
// Full Database interface (matches Supabase-generated format exactly)
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          role: Database['public']['Enums']['user_role']
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          customer_id: string
          cafe_name: string
          instagram_handle: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          country: string | null
          contact_person: string | null
          preferred_payment_method: string | null
          cafe_type: Database['public']['Enums']['cafe_type_enum'] | null
          cafe_segment: Database['public']['Enums']['cafe_segment_enum'] | null
          matcha_experience: Database['public']['Enums']['matcha_experience_enum'] | null
          monthly_matcha_usage_kg: number | null
          budget_range: string | null
          budget_delivered_price_per_kg: number | null
          budget_currency: string
          is_outbound: boolean
          lead_source: string | null
          current_supplier: string | null
          current_supplier_unknown: boolean
          current_delivered_price_per_kg: number | null
          current_price_unknown: boolean
          likes_about_current: string | null
          dislikes_about_current: string | null
          why_switch: string | null
          definition_of_good_matcha: string | null
          market_intel_notes: string | null
          status: Database['public']['Enums']['customer_status_enum']
          lead_stage: Database['public']['Enums']['lead_stage_enum']
          instagram_url: string | null
          website_url: string | null
          serves_matcha: boolean | null
          platform_used: string | null
          date_generated: string | null
          date_contacted: string | null
          source_region: string | null
          last_imported_at: string | null
          lead_assigned_to: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id?: string
          cafe_name: string
          instagram_handle?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          contact_person?: string | null
          preferred_payment_method?: string | null
          cafe_type?: Database['public']['Enums']['cafe_type_enum'] | null
          cafe_segment?: Database['public']['Enums']['cafe_segment_enum'] | null
          matcha_experience?: Database['public']['Enums']['matcha_experience_enum'] | null
          monthly_matcha_usage_kg?: number | null
          budget_range?: string | null
          budget_delivered_price_per_kg?: number | null
          budget_currency?: string
          is_outbound?: boolean
          lead_source?: string | null
          current_supplier?: string | null
          current_supplier_unknown?: boolean
          current_delivered_price_per_kg?: number | null
          current_price_unknown?: boolean
          likes_about_current?: string | null
          dislikes_about_current?: string | null
          why_switch?: string | null
          definition_of_good_matcha?: string | null
          market_intel_notes?: string | null
          status?: Database['public']['Enums']['customer_status_enum']
          lead_stage?: Database['public']['Enums']['lead_stage_enum']
          instagram_url?: string | null
          website_url?: string | null
          serves_matcha?: boolean | null
          platform_used?: string | null
          date_generated?: string | null
          date_contacted?: string | null
          source_region?: string | null
          last_imported_at?: string | null
          lead_assigned_to?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          cafe_name?: string
          instagram_handle?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          contact_person?: string | null
          preferred_payment_method?: string | null
          cafe_type?: Database['public']['Enums']['cafe_type_enum'] | null
          cafe_segment?: Database['public']['Enums']['cafe_segment_enum'] | null
          matcha_experience?: Database['public']['Enums']['matcha_experience_enum'] | null
          monthly_matcha_usage_kg?: number | null
          budget_range?: string | null
          budget_delivered_price_per_kg?: number | null
          budget_currency?: string
          is_outbound?: boolean
          lead_source?: string | null
          current_supplier?: string | null
          current_supplier_unknown?: boolean
          current_delivered_price_per_kg?: number | null
          current_price_unknown?: boolean
          likes_about_current?: string | null
          dislikes_about_current?: string | null
          why_switch?: string | null
          definition_of_good_matcha?: string | null
          market_intel_notes?: string | null
          status?: Database['public']['Enums']['customer_status_enum']
          lead_stage?: Database['public']['Enums']['lead_stage_enum']
          instagram_url?: string | null
          website_url?: string | null
          serves_matcha?: boolean | null
          platform_used?: string | null
          date_generated?: string | null
          date_contacted?: string | null
          source_region?: string | null
          last_imported_at?: string | null
          lead_assigned_to?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          opportunity_id: string
          customer_id: string
          stage: Database['public']['Enums']['opportunity_stage_enum']
          assigned_to: string | null
          product_match_possible: boolean
          casual_price_shared: boolean
          product_guide_shared: boolean
          lead_source: string | null
          handoff_at: string | null
          handoff_to: string | null
          disqualified_at: string | null
          disqualified_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          opportunity_id?: string
          customer_id: string
          stage?: Database['public']['Enums']['opportunity_stage_enum']
          assigned_to?: string | null
          product_match_possible?: boolean
          casual_price_shared?: boolean
          product_guide_shared?: boolean
          lead_source?: string | null
          handoff_at?: string | null
          handoff_to?: string | null
          disqualified_at?: string | null
          disqualified_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          opportunity_id?: string
          customer_id?: string
          stage?: Database['public']['Enums']['opportunity_stage_enum']
          assigned_to?: string | null
          product_match_possible?: boolean
          casual_price_shared?: boolean
          product_guide_shared?: boolean
          lead_source?: string | null
          handoff_at?: string | null
          handoff_to?: string | null
          disqualified_at?: string | null
          disqualified_reason?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'opportunities_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['customer_id']
          },
        ]
      }
      instagram_logs: {
        Row: {
          log_id: string
          customer_id: string
          message_sent: string | null
          reply_received: string | null
          status: Database['public']['Enums']['instagram_status_enum']
          notes: string | null
          created_at: string
        }
        Insert: {
          log_id?: string
          customer_id: string
          message_sent?: string | null
          reply_received?: string | null
          status?: Database['public']['Enums']['instagram_status_enum']
          notes?: string | null
          created_at?: string
        }
        Update: {
          log_id?: string
          customer_id?: string
          message_sent?: string | null
          reply_received?: string | null
          status?: Database['public']['Enums']['instagram_status_enum']
          notes?: string | null
        }
        Relationships: []
      }
      sample_batches: {
        Row: {
          batch_id: string
          opportunity_id: string
          customer_id: string
          products_sent: Json
          date_shipped: string | null
          tracking_number: string | null
          carrier: string | null
          delivery_status: string | null
          delivery_date: string | null
          feedback_notes: string | null
          result: Database['public']['Enums']['sample_result_enum']
          ship_from: string
          shipped_at: string | null
          delivered_at: string | null
          created_at: string
        }
        Insert: {
          batch_id?: string
          opportunity_id: string
          customer_id: string
          products_sent?: Json
          date_shipped?: string | null
          tracking_number?: string | null
          carrier?: string | null
          delivery_status?: string | null
          delivery_date?: string | null
          feedback_notes?: string | null
          result?: Database['public']['Enums']['sample_result_enum']
          ship_from?: string
          shipped_at?: string | null
          delivered_at?: string | null
          created_at?: string
        }
        Update: {
          batch_id?: string
          opportunity_id?: string
          customer_id?: string
          products_sent?: Json
          date_shipped?: string | null
          tracking_number?: string | null
          carrier?: string | null
          delivery_status?: string | null
          delivery_date?: string | null
          feedback_notes?: string | null
          result?: Database['public']['Enums']['sample_result_enum']
          ship_from?: string
          shipped_at?: string | null
          delivered_at?: string | null
        }
        Relationships: []
      }
      sample_batch_items: {
        Row: {
          item_id: string
          batch_id: string
          product_id: string | null
          product_snapshot: string | null
          qty_grams: number | null
          feedback: Database['public']['Enums']['sample_feedback_enum']
          notes: string | null
        }
        Insert: {
          item_id?: string
          batch_id: string
          product_id?: string | null
          product_snapshot?: string | null
          qty_grams?: number | null
          feedback?: Database['public']['Enums']['sample_feedback_enum']
          notes?: string | null
        }
        Update: {
          item_id?: string
          batch_id?: string
          product_id?: string | null
          product_snapshot?: string | null
          qty_grams?: number | null
          feedback?: Database['public']['Enums']['sample_feedback_enum']
          notes?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          product_id: string
          supplier: string | null
          supplier_product_name: string
          customer_facing_product_name: string
          product_type: string | null
          price_per_kg: number
          landing_cost_per_kg_usd: number | null
          min_selling_price_usd: number | null
          default_selling_price_usd: number | null
          gross_profit_margin: number | null
          harvest: string | null
          tasting_notes: string | null
          inventory_available: number | null
          monthly_available_stock_kg: number | null
          product_guide_url: string | null
          active: boolean
          last_synced_at: string | null
        }
        Insert: {
          product_id: string
          supplier?: string | null
          supplier_product_name: string
          customer_facing_product_name: string
          product_type?: string | null
          price_per_kg: number
          landing_cost_per_kg_usd?: number | null
          min_selling_price_usd?: number | null
          default_selling_price_usd?: number | null
          gross_profit_margin?: number | null
          harvest?: string | null
          tasting_notes?: string | null
          inventory_available?: number | null
          monthly_available_stock_kg?: number | null
          product_guide_url?: string | null
          active?: boolean
          last_synced_at?: string | null
        }
        Update: {
          product_id?: string
          supplier?: string | null
          supplier_product_name?: string
          customer_facing_product_name?: string
          product_type?: string | null
          price_per_kg?: number
          landing_cost_per_kg_usd?: number | null
          min_selling_price_usd?: number | null
          default_selling_price_usd?: number | null
          gross_profit_margin?: number | null
          harvest?: string | null
          tasting_notes?: string | null
          inventory_available?: number | null
          monthly_available_stock_kg?: number | null
          product_guide_url?: string | null
          active?: boolean
          last_synced_at?: string | null
        }
        Relationships: []
      }
      quotations: {
        Row: {
          quotation_id: string
          opportunity_id: string
          customer_id: string
          line_items: Json
          total_amount: number
          payment_terms: Database['public']['Enums']['payment_terms_enum']
          custom_terms: string | null
          shipping_terms: string | null
          status: Database['public']['Enums']['quote_status_enum']
          created_by: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          quotation_id?: string
          opportunity_id: string
          customer_id: string
          line_items?: Json
          total_amount: number
          payment_terms?: Database['public']['Enums']['payment_terms_enum']
          custom_terms?: string | null
          shipping_terms?: string | null
          status?: Database['public']['Enums']['quote_status_enum']
          created_by: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          quotation_id?: string
          opportunity_id?: string
          customer_id?: string
          line_items?: Json
          total_amount?: number
          payment_terms?: Database['public']['Enums']['payment_terms_enum']
          custom_terms?: string | null
          shipping_terms?: string | null
          status?: Database['public']['Enums']['quote_status_enum']
          created_by?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          invoice_id: string
          quotation_id: string
          opportunity_id: string
          customer_id: string
          amount: number
          stripe_payment_link: string | null
          stripe_payment_intent: string | null
          payment_status: Database['public']['Enums']['payment_status_enum']
          payment_terms: string | null
          reviewed_by: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          invoice_id?: string
          quotation_id: string
          opportunity_id: string
          customer_id: string
          amount: number
          stripe_payment_link?: string | null
          stripe_payment_intent?: string | null
          payment_status?: Database['public']['Enums']['payment_status_enum']
          payment_terms?: string | null
          reviewed_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          invoice_id?: string
          quotation_id?: string
          opportunity_id?: string
          customer_id?: string
          amount?: number
          stripe_payment_link?: string | null
          stripe_payment_intent?: string | null
          payment_status?: Database['public']['Enums']['payment_status_enum']
          payment_terms?: string | null
          reviewed_by?: string | null
          approved_at?: string | null
        }
        Relationships: []
      }
      recurring_orders: {
        Row: {
          order_id: string
          customer_id: string
          assigned_closer: string | null
          line_items: Json
          total_amount: number | null
          invoice_id: string | null
          status: string
          notes: string | null
          monthly_volume: number | null
          created_at: string
        }
        Insert: {
          order_id?: string
          customer_id: string
          assigned_closer?: string | null
          line_items?: Json
          total_amount?: number | null
          invoice_id?: string | null
          status?: string
          notes?: string | null
          monthly_volume?: number | null
          created_at?: string
        }
        Update: {
          order_id?: string
          customer_id?: string
          assigned_closer?: string | null
          line_items?: Json
          total_amount?: number | null
          invoice_id?: string | null
          status?: string
          notes?: string | null
          monthly_volume?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          notification_id: string
          user_id: string
          type: Database['public']['Enums']['notification_type_enum']
          message: string
          reference_id: string | null
          reference_type: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          notification_id?: string
          user_id: string
          type: Database['public']['Enums']['notification_type_enum']
          message: string
          reference_id?: string | null
          reference_type?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          notification_id?: string
          user_id?: string
          type?: Database['public']['Enums']['notification_type_enum']
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          read?: boolean
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          log_id: string
          opportunity_id: string
          customer_id: string
          logged_by: string
          call_type: Database['public']['Enums']['call_type_enum']
          called_at: string
          duration_minutes: number | null
          spoke_with_role: string | null
          spoke_with_name: string | null
          outcome: Database['public']['Enums']['call_outcome_enum']
          raw_summary: string | null
          ext_current_supplier: string | null
          ext_current_price_per_kg: number | null
          ext_likes: string | null
          ext_dislikes: string | null
          ext_why_switch: string | null
          ext_definition_good_matcha: string | null
          ext_additional_notes: string | null
          intel_applied: boolean
          created_at: string
        }
        Insert: {
          log_id?: string
          opportunity_id: string
          customer_id: string
          logged_by: string
          call_type?: Database['public']['Enums']['call_type_enum']
          called_at?: string
          duration_minutes?: number | null
          spoke_with_role?: string | null
          spoke_with_name?: string | null
          outcome?: Database['public']['Enums']['call_outcome_enum']
          raw_summary?: string | null
          ext_current_supplier?: string | null
          ext_current_price_per_kg?: number | null
          ext_likes?: string | null
          ext_dislikes?: string | null
          ext_why_switch?: string | null
          ext_definition_good_matcha?: string | null
          ext_additional_notes?: string | null
          intel_applied?: boolean
          created_at?: string
        }
        Update: {
          log_id?: string
          opportunity_id?: string
          customer_id?: string
          logged_by?: string
          call_type?: Database['public']['Enums']['call_type_enum']
          called_at?: string
          duration_minutes?: number | null
          spoke_with_role?: string | null
          spoke_with_name?: string | null
          outcome?: Database['public']['Enums']['call_outcome_enum']
          raw_summary?: string | null
          ext_current_supplier?: string | null
          ext_current_price_per_kg?: number | null
          ext_likes?: string | null
          ext_dislikes?: string | null
          ext_why_switch?: string | null
          ext_definition_good_matcha?: string | null
          ext_additional_notes?: string | null
          intel_applied?: boolean
        }
        Relationships: []
      }
      opportunity_proposals: {
        Row: {
          proposal_id: string
          opportunity_id: string
          sent_at: string | null
          sent_via: string
          notes: string | null
          default_currency: string
          created_by: string
          created_at: string
        }
        Insert: {
          proposal_id?: string
          opportunity_id: string
          sent_at?: string | null
          sent_via?: string
          notes?: string | null
          default_currency?: string
          created_by: string
          created_at?: string
        }
        Update: {
          proposal_id?: string
          opportunity_id?: string
          sent_at?: string | null
          sent_via?: string
          notes?: string | null
          default_currency?: string
          created_by?: string
        }
        Relationships: []
      }
      opportunity_proposal_items: {
        Row: {
          item_id: string
          proposal_id: string
          product_id: string
          price_per_kg: number
          currency: string
          notes: string | null
        }
        Insert: {
          item_id?: string
          proposal_id: string
          product_id: string
          price_per_kg: number
          currency?: string
          notes?: string | null
        }
        Update: {
          item_id?: string
          proposal_id?: string
          product_id?: string
          price_per_kg?: number
          currency?: string
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['user_role']
      }
      create_notification: {
        Args: {
          p_user_id: string
          p_type: Database['public']['Enums']['notification_type_enum']
          p_message: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: string
      }
    }
    Enums: {
      lead_stage_enum:
        | 'new_lead'
        | 'contacted'
        | 'replied'
        | 'qualified'
        | 'handed_off'
        | 'disqualified'
      user_role: 'admin' | 'closer' | 'lead_gen'
      cafe_type_enum:
        | 'coffee_shop'
        | 'matcha_focused'
        | 'already_serving_matcha'
        | 'new_to_matcha'
        | 'other'
      cafe_segment_enum: 'coffee_shop' | 'matcha_specialist' | 'mixed' | 'other'
      matcha_experience_enum: 'new_to_matcha' | 'already_uses_matcha'
      customer_status_enum: 'lead' | 'qualified_opportunity' | 'recurring_customer' | 'lost'
      opportunity_stage_enum:
        | 'lead_created'
        | 'outreach_sent'
        | 'cafe_replied'
        | 'get_info'
        | 'product_guide_sent'
        | 'sample_approved'
        | 'samples_shipped'
        | 'samples_delivered'
        | 'quote_sent'
        | 'collect_feedback'
        | 'deal_won'
        | 'payment_received'
        | 'first_order'
        | 'recurring_customer'
        | 'disqualified'
        | 'lost'
        // Legacy values (kept in DB for compat, not shown in Kanban)
        | 'quote_accepted'
        | 'internal_review_pending'
        | 'invoice_sent'
      instagram_status_enum: 'no_response' | 'replied' | 'interested' | 'not_interested'
      sample_result_enum: 'pending' | 'rejected' | 'approved'
      sample_feedback_enum: 'liked' | 'neutral' | 'disliked' | 'pending'
      payment_terms_enum: '100_upfront' | '50_50' | 'custom'
      quote_status_enum: 'draft' | 'sent' | 'accepted' | 'rejected'
      payment_status_enum: 'pending' | 'paid' | 'failed'
      notification_type_enum:
        | 'sample_delivered'
        | 'quote_accepted'
        | 'invoice_approval_needed'
        | 'payment_received'
        | 'payment_overdue'
        | 'handoff_received'
      call_type_enum: 'discovery' | 'pre_sample' | 'post_delivery' | 'negotiation' | 'general'
      call_outcome_enum: 'not_interested' | 'follow_up' | 'samples_approved' | 'deal_closed' | 'other'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
