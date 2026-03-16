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
export type SupplierStage      = Database['public']['Enums']['supplier_stage_enum']
export type SupplierBusinessType = Database['public']['Enums']['supplier_business_type_enum']
export type SampleTrackingStatus = Database['public']['Enums']['sample_tracking_status_enum']

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new_lead:     'New Lead',
  contacted:    'Contacted',
  replied:      'Replied',
  qualified:    'Qualified',
  handed_off:   'Handed Off',
  disqualified: 'Disqualified',
}

export const SUPPLIER_STAGE_LABELS: Record<SupplierStage, string> = {
  not_started: '未着手',
  inquiry_sent: '問い合わせ連絡済',
  met_at_event: 'イベントでご挨拶',
  in_communication: 'やりとり中',
  visit_scheduled: '訪問予定',
  visited: '訪問済',
  deal_established: '取引成立',
  ng: 'NG',
}

export const SUPPLIER_BUSINESS_TYPE_LABELS: Record<SupplierBusinessType, string> = {
  tea_wholesaler: '製茶問屋',
  farm: '農園',
  broker: 'ブローカー',
  other: 'その他',
}

export const SAMPLE_STATUS_LABELS: Record<SampleTrackingStatus, string> = {
  none: '—',
  waiting: 'サンプル待ち',
  received: 'サンプル着',
  evaluated: '評価済',
}

// Row shorthand types
export type Profile               = Database['public']['Tables']['profiles']['Row']
export type Customer              = Database['public']['Tables']['customers']['Row']
export type Opportunity           = Database['public']['Tables']['opportunities']['Row']
export type InstagramLog          = Database['public']['Tables']['instagram_logs']['Row']
export type MessageChannel = 'instagram_dm' | 'email' | 'whatsapp'
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
export type PricingTier             = Database['public']['Tables']['pricing_tiers']['Row']
export type CrmSetting              = Database['public']['Tables']['crm_settings']['Row']

// Draft messages
export type DraftMessage              = Database['public']['Tables']['draft_messages']['Row']
export type SensoryLog                = Database['public']['Tables']['sensory_logs']['Row']

// Inventory types
export type WarehouseLocation       = Database['public']['Tables']['warehouse_locations']['Row']
export type Sku                     = Database['public']['Tables']['skus']['Row']
export type InventoryLevel          = Database['public']['Tables']['inventory_levels']['Row']
export type InventoryTransaction    = Database['public']['Tables']['inventory_transactions']['Row']
export type USOutboundOrder         = Database['public']['Tables']['us_outbound_orders']['Row']
export type USOutboundOrderItem     = Database['public']['Tables']['us_outbound_order_items']['Row']

// Supplier types
export type Supplier               = Database['public']['Tables']['suppliers']['Row']
export type SupplierCommunication  = Database['public']['Tables']['supplier_communications']['Row']
export type SupplierProduct        = Database['public']['Tables']['supplier_products']['Row']
export type SupplierMessageTemplate = Database['public']['Tables']['supplier_message_templates']['Row']
export type SupplierPurchaseOrder   = Database['public']['Tables']['supplier_purchase_orders']['Row']
export type SupplierPurchaseOrderItem = Database['public']['Tables']['supplier_purchase_order_items']['Row']

// Payment types
export type PaymentMethod = 'stripe_ach' | 'stripe_card' | 'wise_transfer' | 'zelle'

export interface InvoiceLineItem {
  product_name: string
  qty_kg: number
  price_per_kg: number
  subtotal: number
}

export interface InvoiceWithDetails {
  invoice_id: string
  invoice_number: string | null
  opportunity_id: string | null
  customer_id: string
  quotation_id: string | null
  amount: number
  currency: string
  payment_method: PaymentMethod | null
  stripe_payment_link: string | null
  stripe_payment_intent: string | null
  stripe_checkout_session_id: string | null
  wise_transfer_reference: string | null
  wise_bank_details: Record<string, string> | null
  zelle_email: string | null
  line_items_detail: InvoiceLineItem[] | null
  payment_status: 'pending' | 'paid' | 'failed'
  payment_terms: string | null
  due_date: string | null
  paid_at: string | null
  sent_at: string | null
  sent_via: string | null
  notes: string | null
  customer_name: string | null
  reviewed_by: string | null
  approved_at: string | null
  created_at: string
  recurring_order_id: string | null
  payment_split_label: string | null
  payment_group_id: string | null
}

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

export interface OpportunityTableRow extends Opportunity {
  customer: Pick<Customer,
    'customer_id' | 'cafe_name' | 'city' | 'country' | 'state' |
    'contact_person' | 'phone' | 'email' | 'instagram_url' | 'instagram_handle' |
    'address' | 'zip_code' | 'qualified_products' | 'qualified_volume_kg' | 'qualified_budget'
  >
  assigned_profile: Pick<Profile, 'id' | 'name' | 'role'> | null
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

// Inventory joined types
export type InventoryLevelWithDetails = InventoryLevel & {
  sku: Pick<Sku, 'sku_name' | 'sku_type' | 'unit_cost_jpy' | 'product_id' | 'name_external_eng'>
  warehouse: Pick<WarehouseLocation, 'name' | 'short_code'>
}

export type InventoryTransactionWithDetails = InventoryTransaction & {
  sku: Pick<Sku, 'sku_name' | 'name_external_eng'>
  warehouse: Pick<WarehouseLocation, 'name' | 'short_code'> | null
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
      daily_briefs: {
        Row: {
          brief_id: string
          token: string
          brief_data: Record<string, unknown>
          brief_html: string
          brief_text: string
          generated_at: string
          supplier_notes: string | null
          posted_to_chat: boolean
          posted_at: string | null
        }
        Insert: {
          brief_id?: string
          token: string
          brief_data: Record<string, unknown>
          brief_html: string
          brief_text: string
          generated_at?: string
          supplier_notes?: string | null
          posted_to_chat?: boolean
          posted_at?: string | null
        }
        Update: {
          supplier_notes?: string | null
          posted_to_chat?: boolean
          posted_at?: string | null
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
          source_type: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          last_enriched_at: string | null
          contact_title: string | null
          linkedin_url: string | null
          company_size: string | null
          qualified_products: string | null
          qualified_volume_kg: number | null
          qualified_budget: string | null
          qualified_samples_agreed: boolean
          qualified_at: string | null
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
          source_type?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          last_enriched_at?: string | null
          contact_title?: string | null
          linkedin_url?: string | null
          company_size?: string | null
          qualified_products?: string | null
          qualified_volume_kg?: number | null
          qualified_budget?: string | null
          qualified_samples_agreed?: boolean
          qualified_at?: string | null
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
          source_type?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          last_enriched_at?: string | null
          contact_title?: string | null
          linkedin_url?: string | null
          company_size?: string | null
          qualified_products?: string | null
          qualified_volume_kg?: number | null
          qualified_budget?: string | null
          qualified_samples_agreed?: boolean
          qualified_at?: string | null
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
          channel: string
          created_at: string
        }
        Insert: {
          log_id?: string
          customer_id: string
          message_sent?: string | null
          reply_received?: string | null
          status?: Database['public']['Enums']['instagram_status_enum']
          notes?: string | null
          channel?: string
          created_at?: string
        }
        Update: {
          log_id?: string
          customer_id?: string
          message_sent?: string | null
          reply_received?: string | null
          status?: Database['public']['Enums']['instagram_status_enum']
          notes?: string | null
          channel?: string
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
          tracking_url: string | null
          carrier_status: string | null
          carrier_status_detail: string | null
          estimated_delivery: string | null
          last_tracked_at: string | null
          auto_track_enabled: boolean
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
          tracking_url?: string | null
          carrier_status?: string | null
          carrier_status_detail?: string | null
          estimated_delivery?: string | null
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
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
          tracking_url?: string | null
          carrier_status?: string | null
          carrier_status_detail?: string | null
          estimated_delivery?: string | null
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
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
      draft_messages: {
        Row: {
          draft_id: string
          customer_id: string
          opportunity_id: string | null
          batch_id: string | null
          trigger_event: string
          channel: string
          message_text: string
          status: 'pending' | 'sent' | 'dismissed'
          created_at: string
          sent_at: string | null
          dismissed_at: string | null
        }
        Insert: {
          draft_id?: string
          customer_id: string
          opportunity_id?: string | null
          batch_id?: string | null
          trigger_event: string
          channel?: string
          message_text: string
          status?: 'pending' | 'sent' | 'dismissed'
          created_at?: string
          sent_at?: string | null
          dismissed_at?: string | null
        }
        Update: {
          draft_id?: string
          customer_id?: string
          opportunity_id?: string | null
          batch_id?: string | null
          trigger_event?: string
          channel?: string
          message_text?: string
          status?: 'pending' | 'sent' | 'dismissed'
          sent_at?: string | null
          dismissed_at?: string | null
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
          // Migration 011 additions
          date_added: string | null
          name_internal_jpn: string | null
          matcha_cost_per_kg_jpy: number | null
          us_landing_cost_per_kg_usd: number | null
          uk_landing_cost_per_kg_gbp: number | null
          eu_landing_cost_per_kg_eur: number | null
          selling_price_usd: number | null
          min_price_usd: number | null
          selling_price_gbp: number | null
          min_price_gbp: number | null
          selling_price_eur: number | null
          min_price_eur: number | null
          gross_profit_per_kg_usd: number | null
          // Migration 016 additions
          tasting_headline: string | null
          short_description: string | null
          long_description: string | null
          harvest_season: string | null
          cultivar: string | null
          production_region: string | null
          grind_method: string | null
          roast_level: string | null
          texture_description: string | null
          best_for: string | null
          photo_url: string | null
          photo_folder_url: string | null
          is_competitor: boolean
          competitor_producer: string | null
          competitor_url: string | null
          introduced_by: string | null
          should_contact_producer: boolean
          // Migration 017 addition
          primary_supplier_id: string | null
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
          date_added?: string | null
          name_internal_jpn?: string | null
          matcha_cost_per_kg_jpy?: number | null
          us_landing_cost_per_kg_usd?: number | null
          uk_landing_cost_per_kg_gbp?: number | null
          eu_landing_cost_per_kg_eur?: number | null
          selling_price_usd?: number | null
          min_price_usd?: number | null
          selling_price_gbp?: number | null
          min_price_gbp?: number | null
          selling_price_eur?: number | null
          min_price_eur?: number | null
          gross_profit_per_kg_usd?: number | null
          tasting_headline?: string | null
          short_description?: string | null
          long_description?: string | null
          harvest_season?: string | null
          cultivar?: string | null
          production_region?: string | null
          grind_method?: string | null
          roast_level?: string | null
          texture_description?: string | null
          best_for?: string | null
          photo_url?: string | null
          photo_folder_url?: string | null
          is_competitor?: boolean
          competitor_producer?: string | null
          competitor_url?: string | null
          introduced_by?: string | null
          should_contact_producer?: boolean
          primary_supplier_id?: string | null
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
          date_added?: string | null
          name_internal_jpn?: string | null
          matcha_cost_per_kg_jpy?: number | null
          us_landing_cost_per_kg_usd?: number | null
          uk_landing_cost_per_kg_gbp?: number | null
          eu_landing_cost_per_kg_eur?: number | null
          selling_price_usd?: number | null
          min_price_usd?: number | null
          selling_price_gbp?: number | null
          min_price_gbp?: number | null
          selling_price_eur?: number | null
          min_price_eur?: number | null
          gross_profit_per_kg_usd?: number | null
          tasting_headline?: string | null
          short_description?: string | null
          long_description?: string | null
          harvest_season?: string | null
          cultivar?: string | null
          production_region?: string | null
          grind_method?: string | null
          roast_level?: string | null
          texture_description?: string | null
          best_for?: string | null
          photo_url?: string | null
          photo_folder_url?: string | null
          is_competitor?: boolean
          competitor_producer?: string | null
          competitor_url?: string | null
          introduced_by?: string | null
          should_contact_producer?: boolean
          primary_supplier_id?: string | null
        }
        Relationships: []
      }
      sensory_logs: {
        Row: {
          log_id: string
          product_id: string
          taster_name: string
          tasted_at: string
          umami_rating: number | null
          bitterness_rating: number | null
          fineness_rating: number | null
          color_notes: string | null
          texture_notes: string | null
          aroma_notes: string | null
          flavor_notes: string | null
          comparison_notes: string | null
          general_notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          log_id?: string
          product_id: string
          taster_name: string
          tasted_at?: string
          umami_rating?: number | null
          bitterness_rating?: number | null
          fineness_rating?: number | null
          color_notes?: string | null
          texture_notes?: string | null
          aroma_notes?: string | null
          flavor_notes?: string | null
          comparison_notes?: string | null
          general_notes?: string | null
          created_by?: string | null
        }
        Update: {
          log_id?: string
          product_id?: string
          taster_name?: string
          tasted_at?: string
          umami_rating?: number | null
          bitterness_rating?: number | null
          fineness_rating?: number | null
          color_notes?: string | null
          texture_notes?: string | null
          aroma_notes?: string | null
          flavor_notes?: string | null
          comparison_notes?: string | null
          general_notes?: string | null
          created_by?: string | null
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
          quotation_id: string | null
          opportunity_id: string | null
          customer_id: string
          amount: number
          currency: string
          payment_method: string | null
          stripe_payment_link: string | null
          stripe_payment_intent: string | null
          stripe_checkout_session_id: string | null
          wise_transfer_reference: string | null
          wise_bank_details: Json | null
          zelle_email: string | null
          line_items_detail: Json | null
          payment_status: Database['public']['Enums']['payment_status_enum']
          payment_terms: string | null
          due_date: string | null
          paid_at: string | null
          notes: string | null
          invoice_number: string | null
          sent_at: string | null
          sent_via: string | null
          customer_name: string | null
          reviewed_by: string | null
          approved_at: string | null
          created_at: string
          recurring_order_id: string | null
          payment_split_label: string | null
          payment_group_id: string | null
        }
        Insert: {
          invoice_id?: string
          quotation_id?: string | null
          opportunity_id?: string | null
          customer_id: string
          amount: number
          currency?: string
          payment_method?: string | null
          stripe_payment_link?: string | null
          stripe_payment_intent?: string | null
          stripe_checkout_session_id?: string | null
          wise_transfer_reference?: string | null
          wise_bank_details?: Json | null
          zelle_email?: string | null
          line_items_detail?: Json | null
          payment_status?: Database['public']['Enums']['payment_status_enum']
          payment_terms?: string | null
          due_date?: string | null
          paid_at?: string | null
          notes?: string | null
          invoice_number?: string | null
          sent_at?: string | null
          sent_via?: string | null
          customer_name?: string | null
          reviewed_by?: string | null
          approved_at?: string | null
          created_at?: string
          recurring_order_id?: string | null
          payment_split_label?: string | null
          payment_group_id?: string | null
        }
        Update: {
          invoice_id?: string
          quotation_id?: string | null
          opportunity_id?: string | null
          customer_id?: string
          amount?: number
          currency?: string
          payment_method?: string | null
          stripe_payment_link?: string | null
          stripe_payment_intent?: string | null
          stripe_checkout_session_id?: string | null
          wise_transfer_reference?: string | null
          wise_bank_details?: Json | null
          zelle_email?: string | null
          line_items_detail?: Json | null
          payment_status?: Database['public']['Enums']['payment_status_enum']
          payment_terms?: string | null
          due_date?: string | null
          paid_at?: string | null
          notes?: string | null
          invoice_number?: string | null
          sent_at?: string | null
          sent_via?: string | null
          customer_name?: string | null
          reviewed_by?: string | null
          approved_at?: string | null
          recurring_order_id?: string | null
          payment_split_label?: string | null
          payment_group_id?: string | null
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
          currency: string
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
          currency?: string
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
          currency?: string
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
      pricing_tiers: {
        Row: {
          tier_id: string
          product_id: string
          currency: string
          tier_name: string
          min_volume_kg: number
          discount_pct: number
          price_per_kg: number
          created_at: string
        }
        Insert: {
          tier_id?: string
          product_id: string
          currency?: string
          tier_name: string
          min_volume_kg?: number
          discount_pct?: number
          price_per_kg: number
          created_at?: string
        }
        Update: {
          tier_id?: string
          product_id?: string
          currency?: string
          tier_name?: string
          min_volume_kg?: number
          discount_pct?: number
          price_per_kg?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pricing_tiers_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['product_id']
          },
        ]
      }
      crm_settings: {
        Row: {
          key: string
          value: string
          label: string | null
          category: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          label?: string | null
          category?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          label?: string | null
          category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_locations: {
        Row: {
          warehouse_id: string
          name: string
          short_code: string
          address: string | null
          country: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          warehouse_id?: string
          name: string
          short_code: string
          address?: string | null
          country?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          warehouse_id?: string
          name?: string
          short_code?: string
          address?: string | null
          country?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          sku_id: string
          sku_name: string
          product_id: string | null
          name_external_eng: string | null
          name_internal_jpn: string | null
          sku_type: string
          unit_weight_kg: number
          matcha_cost_per_kg_jpy: number | null
          unit_cost_jpy: number | null
          note: string | null
          is_active: boolean
          low_stock_threshold: number | null
          reorder_supplier_id: string | null
          reorder_note: string | null
          created_at: string
        }
        Insert: {
          sku_id?: string
          sku_name: string
          product_id?: string | null
          name_external_eng?: string | null
          name_internal_jpn?: string | null
          sku_type?: string
          unit_weight_kg?: number
          matcha_cost_per_kg_jpy?: number | null
          unit_cost_jpy?: number | null
          note?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          reorder_supplier_id?: string | null
          reorder_note?: string | null
          created_at?: string
        }
        Update: {
          sku_id?: string
          sku_name?: string
          product_id?: string | null
          name_external_eng?: string | null
          name_internal_jpn?: string | null
          sku_type?: string
          unit_weight_kg?: number
          matcha_cost_per_kg_jpy?: number | null
          unit_cost_jpy?: number | null
          note?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          reorder_supplier_id?: string | null
          reorder_note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'skus_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['product_id']
          },
        ]
      }
      inventory_levels: {
        Row: {
          inventory_level_id: string
          sku_id: string
          warehouse_id: string
          quantity: number
          in_transit_qty: number
          updated_at: string
        }
        Insert: {
          inventory_level_id?: string
          sku_id: string
          warehouse_id: string
          quantity?: number
          in_transit_qty?: number
          updated_at?: string
        }
        Update: {
          inventory_level_id?: string
          sku_id?: string
          warehouse_id?: string
          quantity?: number
          in_transit_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_levels_sku_id_fkey'
            columns: ['sku_id']
            referencedRelation: 'skus'
            referencedColumns: ['sku_id']
          },
          {
            foreignKeyName: 'inventory_levels_warehouse_id_fkey'
            columns: ['warehouse_id']
            referencedRelation: 'warehouse_locations'
            referencedColumns: ['warehouse_id']
          },
        ]
      }
      inventory_transactions: {
        Row: {
          transaction_id: string
          transaction_ref: string | null
          date_received: string | null
          date_shipped: string | null
          item_type: string
          movement_type: string
          from_location: string | null
          to_destination: string | null
          sku_id: string
          warehouse_affected: string | null
          qty_change: number
          carrier: string | null
          delivery_status: string | null
          tracking_dhl: string | null
          tracking_fedex: string | null
          tracking_usps: string | null
          tracking_ups: string | null
          note: string | null
          customer_id: string | null
          opportunity_id: string | null
          created_by: string | null
          created_at: string
          last_tracked_at: string | null
          auto_track_enabled: boolean
        }
        Insert: {
          transaction_id?: string
          transaction_ref?: string | null
          date_received?: string | null
          date_shipped?: string | null
          item_type?: string
          movement_type: string
          from_location?: string | null
          to_destination?: string | null
          sku_id: string
          warehouse_affected?: string | null
          qty_change: number
          carrier?: string | null
          delivery_status?: string | null
          tracking_dhl?: string | null
          tracking_fedex?: string | null
          tracking_usps?: string | null
          tracking_ups?: string | null
          note?: string | null
          customer_id?: string | null
          opportunity_id?: string | null
          created_by?: string | null
          created_at?: string
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
        }
        Update: {
          transaction_id?: string
          transaction_ref?: string | null
          date_received?: string | null
          date_shipped?: string | null
          item_type?: string
          movement_type?: string
          from_location?: string | null
          to_destination?: string | null
          sku_id?: string
          warehouse_affected?: string | null
          qty_change?: number
          carrier?: string | null
          delivery_status?: string | null
          tracking_dhl?: string | null
          tracking_fedex?: string | null
          tracking_usps?: string | null
          tracking_ups?: string | null
          note?: string | null
          customer_id?: string | null
          opportunity_id?: string | null
          created_by?: string | null
          created_at?: string
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_transactions_sku_id_fkey'
            columns: ['sku_id']
            referencedRelation: 'skus'
            referencedColumns: ['sku_id']
          },
          {
            foreignKeyName: 'inventory_transactions_warehouse_affected_fkey'
            columns: ['warehouse_affected']
            referencedRelation: 'warehouse_locations'
            referencedColumns: ['warehouse_id']
          },
        ]
      }
      us_outbound_orders: {
        Row: {
          order_id: string
          order_number: string
          customer_id: string | null
          customer_name: string
          status: string
          ship_to_name: string | null
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          ship_to_country: string | null
          date_shipped_from_jp: string | null
          date_received_us: string | null
          date_shipped: string | null
          date_delivered: string | null
          carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          delivery_status: string | null
          last_tracked_at: string | null
          auto_track_enabled: boolean
          shipping_cost_usd: number | null
          total_item_value_usd: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          order_id?: string
          order_number: string
          customer_id?: string | null
          customer_name: string
          status?: string
          ship_to_name?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string | null
          date_shipped_from_jp?: string | null
          date_received_us?: string | null
          date_shipped?: string | null
          date_delivered?: string | null
          carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          delivery_status?: string | null
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
          shipping_cost_usd?: number | null
          total_item_value_usd?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_id?: string
          order_number?: string
          customer_id?: string | null
          customer_name?: string
          status?: string
          ship_to_name?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          ship_to_country?: string | null
          date_shipped_from_jp?: string | null
          date_received_us?: string | null
          date_shipped?: string | null
          date_delivered?: string | null
          carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          delivery_status?: string | null
          last_tracked_at?: string | null
          auto_track_enabled?: boolean
          shipping_cost_usd?: number | null
          total_item_value_usd?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      us_outbound_order_items: {
        Row: {
          item_id: string
          order_id: string
          sku_id: string
          sku_name: string
          product_description: string | null
          quantity: number
          unit_value_usd: number | null
          subtotal_usd: number | null
        }
        Insert: {
          item_id?: string
          order_id: string
          sku_id: string
          sku_name: string
          product_description?: string | null
          quantity: number
          unit_value_usd?: number | null
          subtotal_usd?: number | null
        }
        Update: {
          item_id?: string
          order_id?: string
          sku_id?: string
          sku_name?: string
          product_description?: string | null
          quantity?: number
          unit_value_usd?: number | null
          subtotal_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'us_outbound_order_items_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'us_outbound_orders'
            referencedColumns: ['order_id']
          },
          {
            foreignKeyName: 'us_outbound_order_items_sku_id_fkey'
            columns: ['sku_id']
            referencedRelation: 'skus'
            referencedColumns: ['sku_id']
          },
        ]
      }
      suppliers: {
        Row: {
          supplier_id: string
          supplier_name: string
          supplier_name_en: string | null
          contact_person: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          prefecture: string | null
          country: string
          website_url: string | null
          instagram_url: string | null
          stage: Database['public']['Enums']['supplier_stage_enum']
          business_type: Database['public']['Enums']['supplier_business_type_enum'] | null
          sample_status: Database['public']['Enums']['sample_tracking_status_enum']
          source: string | null
          specialty: string | null
          certifications: string[] | null
          annual_capacity_kg: number | null
          lead_time_days: number | null
          payment_terms: string | null
          memo: string | null
          action_memo: string | null
          notes: string | null
          assigned_to: string | null
          first_contacted_at: string | null
          last_contacted_at: string | null
          date_updated: string | null
          converted_at: string | null
          quality_rating: number | null
          reliability_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          supplier_id?: string
          supplier_name: string
          supplier_name_en?: string | null
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          prefecture?: string | null
          country?: string
          website_url?: string | null
          instagram_url?: string | null
          stage?: Database['public']['Enums']['supplier_stage_enum']
          business_type?: Database['public']['Enums']['supplier_business_type_enum'] | null
          sample_status?: Database['public']['Enums']['sample_tracking_status_enum']
          source?: string | null
          specialty?: string | null
          certifications?: string[] | null
          annual_capacity_kg?: number | null
          lead_time_days?: number | null
          payment_terms?: string | null
          memo?: string | null
          action_memo?: string | null
          notes?: string | null
          assigned_to?: string | null
          first_contacted_at?: string | null
          last_contacted_at?: string | null
          date_updated?: string | null
          converted_at?: string | null
          quality_rating?: number | null
          reliability_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          supplier_id?: string
          supplier_name?: string
          supplier_name_en?: string | null
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          prefecture?: string | null
          country?: string
          website_url?: string | null
          instagram_url?: string | null
          stage?: Database['public']['Enums']['supplier_stage_enum']
          business_type?: Database['public']['Enums']['supplier_business_type_enum'] | null
          sample_status?: Database['public']['Enums']['sample_tracking_status_enum']
          source?: string | null
          specialty?: string | null
          certifications?: string[] | null
          annual_capacity_kg?: number | null
          lead_time_days?: number | null
          payment_terms?: string | null
          memo?: string | null
          action_memo?: string | null
          notes?: string | null
          assigned_to?: string | null
          first_contacted_at?: string | null
          last_contacted_at?: string | null
          date_updated?: string | null
          converted_at?: string | null
          quality_rating?: number | null
          reliability_rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_communications: {
        Row: {
          comm_id: string
          supplier_id: string
          channel: string
          direction: string
          subject: string | null
          message_body: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          comm_id?: string
          supplier_id: string
          channel?: string
          direction?: string
          subject?: string | null
          message_body?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          comm_id?: string
          supplier_id?: string
          channel?: string
          direction?: string
          subject?: string | null
          message_body?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_communications_supplier_id_fkey'
            columns: ['supplier_id']
            referencedRelation: 'suppliers'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      supplier_products: {
        Row: {
          id: string
          supplier_id: string
          product_id: string | null
          product_name_jpn: string | null
          cost_per_kg_jpy: number | null
          moq_kg: number | null
          is_primary: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          product_id?: string | null
          product_name_jpn?: string | null
          cost_per_kg_jpy?: number | null
          moq_kg?: number | null
          is_primary?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          product_id?: string | null
          product_name_jpn?: string | null
          cost_per_kg_jpy?: number | null
          moq_kg?: number | null
          is_primary?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_products_supplier_id_fkey'
            columns: ['supplier_id']
            referencedRelation: 'suppliers'
            referencedColumns: ['supplier_id']
          },
          {
            foreignKeyName: 'supplier_products_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['product_id']
          },
        ]
      }
      supplier_message_templates: {
        Row: {
          template_id: string
          template_name: string
          channel: string
          message_body: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          template_id?: string
          template_name: string
          channel?: string
          message_body: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          template_id?: string
          template_name?: string
          channel?: string
          message_body?: string
          is_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      supplier_purchase_orders: {
        Row: {
          po_id: string
          po_number: string
          supplier_id: string
          order_date: string
          expected_delivery: string | null
          actual_delivery: string | null
          delivery_status: string
          total_amount_jpy: number | null
          payment_status: string
          payment_date: string | null
          quality_rating: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          po_id?: string
          po_number: string
          supplier_id: string
          order_date?: string
          expected_delivery?: string | null
          actual_delivery?: string | null
          delivery_status?: string
          total_amount_jpy?: number | null
          payment_status?: string
          payment_date?: string | null
          quality_rating?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          po_id?: string
          po_number?: string
          supplier_id?: string
          order_date?: string
          expected_delivery?: string | null
          actual_delivery?: string | null
          delivery_status?: string
          total_amount_jpy?: number | null
          payment_status?: string
          payment_date?: string | null
          quality_rating?: number | null
          notes?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_purchase_orders_supplier_id_fkey'
            columns: ['supplier_id']
            referencedRelation: 'suppliers'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      supplier_purchase_order_items: {
        Row: {
          item_id: string
          po_id: string
          product_id: string | null
          product_name_jpn: string | null
          quantity_kg: number
          price_per_kg_jpy: number
          subtotal_jpy: number | null
          notes: string | null
        }
        Insert: {
          item_id?: string
          po_id: string
          product_id?: string | null
          product_name_jpn?: string | null
          quantity_kg: number
          price_per_kg_jpy: number
          subtotal_jpy?: number | null
          notes?: string | null
        }
        Update: {
          item_id?: string
          po_id?: string
          product_id?: string | null
          product_name_jpn?: string | null
          quantity_kg?: number
          price_per_kg_jpy?: number
          subtotal_jpy?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_purchase_order_items_po_id_fkey'
            columns: ['po_id']
            referencedRelation: 'supplier_purchase_orders'
            referencedColumns: ['po_id']
          },
        ]
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
      nextval_text: {
        Args: { seq_name: string }
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
      supplier_stage_enum:
        | 'not_started'
        | 'inquiry_sent'
        | 'met_at_event'
        | 'in_communication'
        | 'visit_scheduled'
        | 'visited'
        | 'deal_established'
        | 'ng'
      supplier_business_type_enum: 'tea_wholesaler' | 'farm' | 'broker' | 'other'
      sample_tracking_status_enum: 'none' | 'waiting' | 'received' | 'evaluated'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
