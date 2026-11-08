export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      body_measurements: {
        Row: {
          client_updated_at: string | null;
          created_at: string;
          id: string;
          local_date: string;
          measured_at: string;
          measurement_type: string;
          updated_at: string;
          user_id: string;
          value_cm: number;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          local_date: string;
          measured_at: string;
          measurement_type: string;
          updated_at?: string;
          user_id: string;
          value_cm: number;
        };
        Update: {
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          local_date?: string;
          measured_at?: string;
          measurement_type?: string;
          updated_at?: string;
          user_id?: string;
          value_cm?: number;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          consent_type: string;
          document_version: string;
          granted: boolean;
          id: string;
          recorded_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          consent_type: string;
          document_version: string;
          granted: boolean;
          id?: string;
          recorded_at?: string;
          user_id: string;
        };
        Update: {
          consent_type?: string;
          document_version?: string;
          granted?: boolean;
          id?: string;
          recorded_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_checkins: {
        Row: {
          client_updated_at: string | null;
          created_at: string;
          fatigue: number | null;
          local_date: string;
          note: string | null;
          pain: number | null;
          pain_area: string | null;
          sleep_hours: number | null;
          soreness: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at?: string | null;
          created_at?: string;
          fatigue?: number | null;
          local_date: string;
          note?: string | null;
          pain?: number | null;
          pain_area?: string | null;
          sleep_hours?: number | null;
          soreness?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_updated_at?: string | null;
          created_at?: string;
          fatigue?: number | null;
          local_date?: string;
          note?: string | null;
          pain?: number | null;
          pain_area?: string | null;
          sleep_hours?: number | null;
          soreness?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      health_conditions: {
        Row: {
          body_area: string | null;
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          onset_date: string | null;
          pain_level: number | null;
          professional_clearance: boolean;
          professional_restrictions: string | null;
          resolved_at: string | null;
          restriction_tags: string[];
          side: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body_area?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          onset_date?: string | null;
          pain_level?: number | null;
          professional_clearance?: boolean;
          professional_restrictions?: string | null;
          resolved_at?: string | null;
          restriction_tags?: string[];
          side?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body_area?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          onset_date?: string | null;
          pain_level?: number | null;
          professional_clearance?: boolean;
          professional_restrictions?: string | null;
          resolved_at?: string | null;
          restriction_tags?: string[];
          side?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_targets: {
        Row: {
          bmr: number | null;
          calculation_inputs: NonNullable<Json>;
          calculation_version: string;
          carbs_g: number;
          created_at: string;
          effective_from: string;
          fat_g: number;
          fibre_g: number | null;
          floor_kcal: number | null;
          id: string;
          is_user_edited: boolean;
          kcal: number;
          limited_by_floor: boolean;
          protein_g: number;
          tdee: number | null;
          updated_at: string;
          user_id: string;
          water_ml: number | null;
        };
        ComputedFields: never;
        Insert: {
          bmr?: number | null;
          calculation_inputs?: NonNullable<Json>;
          calculation_version: string;
          carbs_g: number;
          created_at?: string;
          effective_from: string;
          fat_g: number;
          fibre_g?: number | null;
          floor_kcal?: number | null;
          id?: string;
          is_user_edited?: boolean;
          kcal: number;
          limited_by_floor?: boolean;
          protein_g: number;
          tdee?: number | null;
          updated_at?: string;
          user_id: string;
          water_ml?: number | null;
        };
        Update: {
          bmr?: number | null;
          calculation_inputs?: NonNullable<Json>;
          calculation_version?: string;
          carbs_g?: number;
          created_at?: string;
          effective_from?: string;
          fat_g?: number;
          fibre_g?: number | null;
          floor_kcal?: number | null;
          id?: string;
          is_user_edited?: boolean;
          kcal?: number;
          limited_by_floor?: boolean;
          protein_g?: number;
          tdee?: number | null;
          updated_at?: string;
          user_id?: string;
          water_ml?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          activity_level: string | null;
          average_daily_steps: number | null;
          calc_sex: string | null;
          created_at: string;
          date_of_birth: string | null;
          display_name: string | null;
          height_cm: number | null;
          id: string;
          onboarding_completed_at: string | null;
          onboarding_step: string | null;
          timezone: string;
          unit_system: string;
          updated_at: string;
          week_start: number;
        };
        ComputedFields: never;
        Insert: {
          activity_level?: string | null;
          average_daily_steps?: number | null;
          calc_sex?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          height_cm?: number | null;
          id: string;
          onboarding_completed_at?: string | null;
          onboarding_step?: string | null;
          timezone?: string;
          unit_system?: string;
          updated_at?: string;
          week_start?: number;
        };
        Update: {
          activity_level?: string | null;
          average_daily_steps?: number | null;
          calc_sex?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          display_name?: string | null;
          height_cm?: number | null;
          id?: string;
          onboarding_completed_at?: string | null;
          onboarding_step?: string | null;
          timezone?: string;
          unit_system?: string;
          updated_at?: string;
          week_start?: number;
        };
        Relationships: [];
      };
      recurring_events: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          duration_minutes: number;
          ends_on: string | null;
          id: string;
          intensity: string;
          local_time: string;
          starts_on: string;
          template_slug: string | null;
          timezone: string;
          title: string;
          training_plan_id: string | null;
          updated_at: string;
          user_id: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category: string;
          created_at?: string;
          duration_minutes: number;
          ends_on?: string | null;
          id?: string;
          intensity: string;
          local_time: string;
          starts_on: string;
          template_slug?: string | null;
          timezone: string;
          title: string;
          training_plan_id?: string | null;
          updated_at?: string;
          user_id: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          duration_minutes?: number;
          ends_on?: string | null;
          id?: string;
          intensity?: string;
          local_time?: string;
          starts_on?: string;
          template_slug?: string | null;
          timezone?: string;
          title?: string;
          training_plan_id?: string | null;
          updated_at?: string;
          user_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_events_training_plan_id_fkey';
            columns: ['training_plan_id'];
            isOneToOne: false;
            referencedRelation: 'training_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      training_plans: {
        Row: {
          created_at: string;
          end_date: string | null;
          generated_from: NonNullable<Json>;
          generator_version: string;
          goal_type: string;
          id: string;
          name: string;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
          weekly_pattern: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_date?: string | null;
          generated_from?: NonNullable<Json>;
          generator_version: string;
          goal_type: string;
          id?: string;
          name: string;
          start_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          weekly_pattern?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          generated_from?: NonNullable<Json>;
          generator_version?: string;
          goal_type?: string;
          id?: string;
          name?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          weekly_pattern?: NonNullable<Json>;
        };
        Relationships: [];
      };
      user_equipment: {
        Row: {
          created_at: string;
          custom_name: string | null;
          equipment_type: string;
          id: string;
          max_weight_kg: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_name?: string | null;
          equipment_type: string;
          id?: string;
          max_weight_kg?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          custom_name?: string | null;
          equipment_type?: string;
          id?: string;
          max_weight_kg?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_goals: {
        Row: {
          created_at: string;
          ended_at: string | null;
          focus_tags: string[];
          goal_type: string;
          id: string;
          secondary_target_weight_kg: number | null;
          started_at: string;
          starting_weight_kg: number;
          status: string;
          target_date: string | null;
          target_weight_kg: number | null;
          updated_at: string;
          user_id: string;
          weekly_rate_pct: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          focus_tags?: string[];
          goal_type: string;
          id?: string;
          secondary_target_weight_kg?: number | null;
          started_at?: string;
          starting_weight_kg: number;
          status?: string;
          target_date?: string | null;
          target_weight_kg?: number | null;
          updated_at?: string;
          user_id: string;
          weekly_rate_pct?: number | null;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          focus_tags?: string[];
          goal_type?: string;
          id?: string;
          secondary_target_weight_kg?: number | null;
          started_at?: string;
          starting_weight_kg?: number;
          status?: string;
          target_date?: string | null;
          target_weight_kg?: number | null;
          updated_at?: string;
          user_id?: string;
          weekly_rate_pct?: number | null;
        };
        Relationships: [];
      };
      user_milestones: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          metadata: NonNullable<Json>;
          milestone_key: string;
          threshold: number | null;
          title: string;
          unlocked_at: string;
          user_id: string;
          value: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          milestone_key: string;
          threshold?: number | null;
          title: string;
          unlocked_at?: string;
          user_id: string;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          milestone_key?: string;
          threshold?: number | null;
          title?: string;
          unlocked_at?: string;
          user_id?: string;
          value?: number | null;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          allergies: string[];
          cooking_time_max_minutes: number | null;
          created_at: string;
          diet_type: string | null;
          disliked_foods: string[];
          household_servings: number;
          intolerances: string[];
          locale: string;
          max_session_minutes: number;
          meals_per_day: number;
          notification_preferences: NonNullable<Json>;
          preferred_cuisines: string[];
          preferred_training_days: number[];
          preferred_training_time: string | null;
          training_days_per_week: number | null;
          training_environment: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          allergies?: string[];
          cooking_time_max_minutes?: number | null;
          created_at?: string;
          diet_type?: string | null;
          disliked_foods?: string[];
          household_servings?: number;
          intolerances?: string[];
          locale?: string;
          max_session_minutes?: number;
          meals_per_day?: number;
          notification_preferences?: NonNullable<Json>;
          preferred_cuisines?: string[];
          preferred_training_days?: number[];
          preferred_training_time?: string | null;
          training_days_per_week?: number | null;
          training_environment?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allergies?: string[];
          cooking_time_max_minutes?: number | null;
          created_at?: string;
          diet_type?: string | null;
          disliked_foods?: string[];
          household_servings?: number;
          intolerances?: string[];
          locale?: string;
          max_session_minutes?: number;
          meals_per_day?: number;
          notification_preferences?: NonNullable<Json>;
          preferred_cuisines?: string[];
          preferred_training_days?: number[];
          preferred_training_time?: string | null;
          training_days_per_week?: number | null;
          training_environment?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      weight_entries: {
        Row: {
          client_updated_at: string | null;
          created_at: string;
          id: string;
          local_date: string;
          measured_at: string;
          note: string | null;
          source: string;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          local_date: string;
          measured_at: string;
          note?: string | null;
          source?: string;
          updated_at?: string;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          local_date?: string;
          measured_at?: string;
          note?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: { Args: { payload: Json }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
