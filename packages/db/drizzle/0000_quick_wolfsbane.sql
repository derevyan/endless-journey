CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."crm_field_type" AS ENUM('text', 'number', 'date', 'select', 'multi_select');--> statement-breakpoint
CREATE TYPE "public"."failed_event_status" AS ENUM('pending', 'retrying', 'failed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."journey_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'read');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'photo', 'video', 'audio', 'document', 'sticker', 'contact', 'location', 'buttons');--> statement-breakpoint
CREATE TYPE "public"."mindstate_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('telegram', 'whatsapp', 'simulator');--> statement-breakpoint
CREATE TYPE "public"."prompt_type" AS ENUM('text', 'chat');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('live', 'test', 'simulation');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'dropped', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."tag_action" AS ENUM('added', 'removed');--> statement-breakpoint
CREATE TYPE "public"."timeout_action" AS ENUM('approve', 'reject', 'skip');--> statement-breakpoint
CREATE TYPE "public"."timer_status" AS ENUM('active', 'paused', 'fired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transfer_trigger" AS ENUM('ai_tool', 'teleport_node', 'api');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('tag_change', 'variable_condition', 'journey_completed', 'schedule', 'webhook', 'crm_stage_change', 'crm_field_change', 'crm_pipeline_entered');--> statement-breakpoint
CREATE TYPE "public"."variable_scope" AS ENUM('user', 'journey', 'global');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"system_prompt" text NOT NULL,
	"llm" jsonb NOT NULL,
	"tools" jsonb,
	"conversation_history" jsonb,
	"memory" jsonb,
	"response_format" jsonb,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"journey_id" uuid,
	"memory_type" text DEFAULT 'semantic' NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_memories_client_org_key_unique" UNIQUE("client_id","organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "agent_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"configuration" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"settings" jsonb,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"trigger_type" "trigger_type" NOT NULL,
	"tag_id" uuid,
	"tag_action" "tag_action",
	"variable_id" uuid,
	"variable_scope" "variable_scope",
	"expression" text,
	"source_journey_id" uuid,
	"cron_expression" text,
	"timezone" text DEFAULT 'UTC',
	"crm_pipeline_id" uuid,
	"crm_stage_id" uuid,
	"crm_field_key" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_id" uuid NOT NULL,
	"secret_key_encrypted" text NOT NULL,
	"secret_key_hash" text NOT NULL,
	"allowed_ips" text,
	"rate_limit" text DEFAULT '100/hour',
	"last_called_at" timestamp with time zone,
	"call_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhooks_trigger_unique" UNIQUE("trigger_id")
);
--> statement-breakpoint
CREATE TABLE "client_mindstates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"state_parameters" jsonb NOT NULL,
	"system_agents" jsonb NOT NULL,
	"agent_insights" jsonb DEFAULT '[]'::jsonb,
	"last_analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_mindstate_unique" UNIQUE("client_id","definition_id")
);
--> statement-breakpoint
CREATE TABLE "client_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tags_unique" UNIQUE("client_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" DEFAULT 'telegram' NOT NULL,
	"platform_user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"username" text,
	"metadata" jsonb,
	"is_test" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "messages_is_array" CHECK (jsonb_typeof("conversations"."messages") = 'array')
);
--> statement-breakpoint
CREATE TABLE "crm_client_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_field_values_unique" UNIQUE("client_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "crm_client_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "crm_client_stage_pipeline" UNIQUE("client_id","pipeline_id")
);
--> statement-breakpoint
CREATE TABLE "crm_custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"field_type" "crm_field_type" NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false,
	"position" integer NOT NULL,
	"validation" jsonb,
	"default_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_fields_org_key" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "crm_direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"channel_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" "message_status" DEFAULT 'pending',
	"platform_message_id" text,
	"error_message" text,
	"sent_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_stages_pipeline_name" UNIQUE("pipeline_id","name")
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_pipelines_org_name" UNIQUE("organization_id","name"),
	CONSTRAINT "crm_pipelines_org_slug" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "crm_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"pipeline_id" uuid,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"duration_ms" bigint
);
--> statement-breakpoint
CREATE TABLE "durable_timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"channel_id" uuid,
	"edge_id" text NOT NULL,
	"fires_at" timestamp with time zone NOT NULL,
	"paused_at" timestamp with time zone,
	"bullmq_job_id" text,
	"status" timer_status DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" uuid,
	"session_id" uuid,
	"journey_id" uuid,
	"source" text NOT NULL,
	"performed_by" text,
	"sequence" integer NOT NULL,
	"correlation_id" uuid,
	"caused_by" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"journey_id" uuid,
	"organization_id" text,
	"event_type" text NOT NULL,
	"event_payload" jsonb NOT NULL,
	"session_context" jsonb,
	"current_node_id" text,
	"error_message" text NOT NULL,
	"error_stack" text,
	"retry_count" integer DEFAULT 0,
	"status" "failed_event_status" DEFAULT 'pending',
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"node_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"inviter_id" text NOT NULL,
	"status" "invitation_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"type" "media_type" NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"key" text NOT NULL,
	"size" bigint,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"channel_id" uuid,
	"journey_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"current_node_id" text NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"mode" "session_mode" DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journey_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"from_journey_id" uuid NOT NULL,
	"to_journey_id" uuid NOT NULL,
	"from_session_id" uuid,
	"to_session_id" uuid,
	"triggered_by" "transfer_trigger" NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"version_id" text NOT NULL,
	"notes" text,
	"configuration" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_journey_version" UNIQUE("journey_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"description" text,
	"status" "journey_status" DEFAULT 'draft' NOT NULL,
	"configuration" jsonb NOT NULL,
	"organization_id" text NOT NULL,
	"mindstate_config" jsonb,
	"transfer_allowlist" jsonb,
	"default_pipeline_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journeys_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "llm_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"journey_id" uuid,
	"journey_session_id" uuid,
	"client_id" uuid,
	"service" text NOT NULL,
	"module" text,
	"tool" text,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"duration_ms" integer,
	"system_prompt" text,
	"input_messages" jsonb,
	"output_content" text,
	"output_tool_calls" jsonb,
	"finish_reason" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"platform" "platform" DEFAULT 'telegram' NOT NULL,
	"bot_token_encrypted" text NOT NULL,
	"bot_token_hash" text NOT NULL,
	"bot_username" text,
	"bot_name" text,
	"default_journey_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"webhook_url" text,
	"webhook_secret_encrypted" text,
	"webhook_secret_hash" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindstate_analysis_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_mindstate_id" uuid NOT NULL,
	"session_id" uuid,
	"trigger" text NOT NULL,
	"metrics" jsonb,
	"changes" jsonb DEFAULT '[]'::jsonb,
	"new_insights" jsonb DEFAULT '[]'::jsonb,
	"input_message" text,
	"response_message" text,
	"failed_agents" jsonb DEFAULT '[]'::jsonb,
	"conflicts" jsonb DEFAULT '[]'::jsonb,
	"main_agent_error" text,
	"partial_success" boolean DEFAULT false,
	"all_agents_failed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindstate_definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" text NOT NULL,
	"notes" text,
	"configuration" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_definition_version" UNIQUE("definition_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "mindstate_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"main_agent_config" jsonb NOT NULL,
	"default_agents" jsonb NOT NULL,
	"default_parameters" jsonb NOT NULL,
	"analysis_mode" text DEFAULT 'automatic',
	"categories" jsonb DEFAULT '[]'::jsonb,
	"status" "mindstate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mindstate_defs_org_key" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "node_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sanitized_label" text NOT NULL,
	"node_id" text NOT NULL,
	"node_label" text,
	"node_type" text,
	"data" jsonb NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_outputs_session_label_unique" UNIQUE("session_id","sanitized_label")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"config" jsonb,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_versions_unique" UNIQUE("prompt_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "prompt_type" NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_system" boolean DEFAULT false,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"interaction_event_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_message_id" text,
	"platform_chat_id" text NOT NULL,
	"message_type" "message_type" NOT NULL,
	"content" text,
	"reply_to_message_id" text,
	"metadata" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tag_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_defs_unique_org_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "telegram_file_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"media_type" "media_type" NOT NULL,
	"file_id" text NOT NULL,
	"file_unique_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid,
	"profile" jsonb DEFAULT '{}'::jsonb,
	"user_vars" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_personas_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"scope" "variable_scope" NOT NULL,
	"owner_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variables_org_scope_owner_key_unique" UNIQUE("organization_id","scope","owner_id","key")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_run_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"node_id" text NOT NULL,
	"message" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"execution_state" jsonb,
	"timeout_seconds" integer,
	"timeout_action" timeout_action,
	"expires_at" timestamp with time zone,
	"timeout_job_id" text,
	"allowed_roles" jsonb,
	"responded_by" text,
	"responded_at" timestamp with time zone,
	"response_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" text NOT NULL,
	"notes" text,
	"configuration" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_workflow_version" UNIQUE("workflow_id","version_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_tag_id_tag_definitions_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_variable_id_variables_id_fk" FOREIGN KEY ("variable_id") REFERENCES "public"."variables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_source_journey_id_journeys_id_fk" FOREIGN KEY ("source_journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_crm_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("crm_pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_triggers" ADD CONSTRAINT "automation_triggers_crm_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("crm_stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_webhooks" ADD CONSTRAINT "automation_webhooks_trigger_id_automation_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."automation_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_mindstates" ADD CONSTRAINT "client_mindstates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_mindstates" ADD CONSTRAINT "client_mindstates_definition_id_mindstate_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."mindstate_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_tag_id_tag_definitions_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_field_values" ADD CONSTRAINT "crm_client_field_values_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_field_values" ADD CONSTRAINT "crm_client_field_values_field_id_crm_custom_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."crm_custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_field_values" ADD CONSTRAINT "crm_client_field_values_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_stages" ADD CONSTRAINT "crm_client_stages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_stages" ADD CONSTRAINT "crm_client_stages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_stages" ADD CONSTRAINT "crm_client_stages_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_stages" ADD CONSTRAINT "crm_client_stages_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_stages" ADD CONSTRAINT "crm_client_stages_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_direct_messages" ADD CONSTRAINT "crm_direct_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_direct_messages" ADD CONSTRAINT "crm_direct_messages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_direct_messages" ADD CONSTRAINT "crm_direct_messages_channel_id_messaging_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."messaging_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_direct_messages" ADD CONSTRAINT "crm_direct_messages_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_from_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_to_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "durable_timers" ADD CONSTRAINT "durable_timers_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "durable_timers" ADD CONSTRAINT "durable_timers_channel_id_messaging_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."messaging_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_events" ADD CONSTRAINT "failed_events_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_events" ADD CONSTRAINT "failed_events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_events" ADD CONSTRAINT "failed_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_media" ADD CONSTRAINT "journey_media_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_media" ADD CONSTRAINT "journey_media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_sessions" ADD CONSTRAINT "journey_sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_sessions" ADD CONSTRAINT "journey_sessions_channel_id_messaging_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."messaging_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_sessions" ADD CONSTRAINT "journey_sessions_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_sessions" ADD CONSTRAINT "journey_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_from_journey_id_journeys_id_fk" FOREIGN KEY ("from_journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_to_journey_id_journeys_id_fk" FOREIGN KEY ("to_journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_from_session_id_journey_sessions_id_fk" FOREIGN KEY ("from_session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_transfers" ADD CONSTRAINT "journey_transfers_to_session_id_journey_sessions_id_fk" FOREIGN KEY ("to_session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_versions" ADD CONSTRAINT "journey_versions_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_versions" ADD CONSTRAINT "journey_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_default_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("default_pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_journey_session_id_journey_sessions_id_fk" FOREIGN KEY ("journey_session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_default_journey_id_journeys_id_fk" FOREIGN KEY ("default_journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindstate_analysis_log" ADD CONSTRAINT "mindstate_analysis_log_client_mindstate_id_client_mindstates_id_fk" FOREIGN KEY ("client_mindstate_id") REFERENCES "public"."client_mindstates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindstate_analysis_log" ADD CONSTRAINT "mindstate_analysis_log_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindstate_definition_versions" ADD CONSTRAINT "mindstate_definition_versions_definition_id_mindstate_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."mindstate_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindstate_definition_versions" ADD CONSTRAINT "mindstate_definition_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindstate_definitions" ADD CONSTRAINT "mindstate_definitions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_outputs" ADD CONSTRAINT "node_outputs_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_session_id_journey_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."journey_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_messages" ADD CONSTRAINT "sent_messages_interaction_event_id_interactions_id_fk" FOREIGN KEY ("interaction_event_id") REFERENCES "public"."interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_definitions" ADD CONSTRAINT "tag_definitions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_file_cache" ADD CONSTRAINT "telegram_file_cache_channel_id_messaging_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."messaging_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_file_cache" ADD CONSTRAINT "telegram_file_cache_media_id_journey_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."journey_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_personas" ADD CONSTRAINT "test_personas_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_personas" ADD CONSTRAINT "test_personas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variables" ADD CONSTRAINT "variables_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_responded_by_user_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_definitions_org" ON "agent_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_agent_definitions_status" ON "agent_definitions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_agent_definitions_org_key" ON "agent_definitions" USING btree ("organization_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_agent_memories_client" ON "agent_memories" USING btree ("client_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memories_org" ON "agent_memories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memories_journey" ON "agent_memories" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_agent_memories_embedding_hnsw" ON "agent_memories" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_workflows_org" ON "agent_workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_agent_workflows_status" ON "agent_workflows" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_agent_workflows_org_key" ON "agent_workflows" USING btree ("organization_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_triggers_tag" ON "automation_triggers" USING btree ("organization_id","trigger_type","tag_id","tag_action");--> statement-breakpoint
CREATE INDEX "idx_triggers_var" ON "automation_triggers" USING btree ("organization_id","trigger_type","variable_id","variable_scope");--> statement-breakpoint
CREATE INDEX "idx_triggers_journey_completed" ON "automation_triggers" USING btree ("organization_id","trigger_type","source_journey_id");--> statement-breakpoint
CREATE INDEX "idx_triggers_journey_active" ON "automation_triggers" USING btree ("journey_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_triggers_org" ON "automation_triggers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_triggers_crm" ON "automation_triggers" USING btree ("organization_id","trigger_type","crm_pipeline_id","crm_stage_id");--> statement-breakpoint
CREATE INDEX "idx_client_mindstates_client" ON "client_mindstates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_mindstates_def" ON "client_mindstates" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "idx_client_tags_client" ON "client_tags" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_tags_tag" ON "client_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clients_platform_user_org" ON "clients" USING btree ("platform","platform_user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_clients_org" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_session" ON "conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_updated" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_crm_field_values_client" ON "crm_client_field_values" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_field_values_field" ON "crm_client_field_values" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_crm_client_stages_client" ON "crm_client_stages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_client_stages_org" ON "crm_client_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_client_stages_pipeline" ON "crm_client_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_crm_client_stages_stage" ON "crm_client_stages" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_crm_fields_org" ON "crm_custom_field_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_messages_client_org" ON "crm_direct_messages" USING btree ("client_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_messages_sent_at" ON "crm_direct_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_crm_messages_channel" ON "crm_direct_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_crm_messages_status" ON "crm_direct_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_stages_pipeline" ON "crm_pipeline_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_crm_stages_org" ON "crm_pipeline_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_pipelines_org" ON "crm_pipelines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_pipelines_org_default" ON "crm_pipelines" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "idx_crm_history_client_org" ON "crm_stage_history" USING btree ("client_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_crm_history_pipeline" ON "crm_stage_history" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_crm_history_changed_at" ON "crm_stage_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "durable_timers_active_idx" ON "durable_timers" USING btree ("status","fires_at");--> statement-breakpoint
CREATE INDEX "durable_timers_session_idx" ON "durable_timers" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_events_org_sequence" ON "events" USING btree ("organization_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_events_org_type_timestamp" ON "events" USING btree ("organization_id","type","timestamp");--> statement-breakpoint
CREATE INDEX "idx_events_session" ON "events" USING btree ("session_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_events_client" ON "events" USING btree ("client_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_events_journey" ON "events" USING btree ("journey_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_events_created_at" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_events_correlation" ON "events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_failed_events_session" ON "failed_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_failed_events_org_status" ON "failed_events" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_failed_events_created" ON "failed_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_interactions_session_time" ON "interactions" USING btree ("session_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_journey_media_journey" ON "journey_media" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_journey" ON "journey_sessions" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_client" ON "journey_sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_channel" ON "journey_sessions" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_status" ON "journey_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_mode" ON "journey_sessions" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_org" ON "journey_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_status_updated" ON "journey_sessions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_journey_sessions_client_updated" ON "journey_sessions" USING btree ("client_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_org" ON "journey_transfers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_client" ON "journey_transfers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_from" ON "journey_transfers" USING btree ("from_journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_to" ON "journey_transfers" USING btree ("to_journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_created" ON "journey_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_from_to" ON "journey_transfers" USING btree ("from_journey_id","to_journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_transfers_sessions" ON "journey_transfers" USING btree ("from_session_id","to_session_id");--> statement-breakpoint
CREATE INDEX "idx_journey_versions_journey" ON "journey_versions" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journeys_org" ON "journeys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_journeys_pipeline" ON "journeys" USING btree ("default_pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_org_created" ON "llm_usage_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_journey_created" ON "llm_usage_events" USING btree ("journey_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_session" ON "llm_usage_events" USING btree ("journey_session_id");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_service" ON "llm_usage_events" USING btree ("service","created_at");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_model" ON "llm_usage_events" USING btree ("model","created_at");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_org_user" ON "llm_usage_events" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_member_org" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_member_user" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_messaging_channels_org" ON "messaging_channels" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messaging_channels_token_hash" ON "messaging_channels" USING btree ("bot_token_hash");--> statement-breakpoint
CREATE INDEX "idx_mindstate_log_mindstate" ON "mindstate_analysis_log" USING btree ("client_mindstate_id");--> statement-breakpoint
CREATE INDEX "idx_mindstate_log_session" ON "mindstate_analysis_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_mindstate_log_created" ON "mindstate_analysis_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mindstate_versions_definition" ON "mindstate_definition_versions" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "idx_mindstate_versions_created" ON "mindstate_definition_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mindstate_defs_org" ON "mindstate_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_mindstate_defs_status" ON "mindstate_definitions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_node_outputs_session" ON "node_outputs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_node_outputs_updated" ON "node_outputs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_prompt" ON "prompt_versions" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_created" ON "prompt_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_labels" ON "prompt_versions" USING gin ("labels");--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_unique_org_name" ON "prompts" USING btree ("organization_id","name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_prompts_org" ON "prompts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_prompts_type" ON "prompts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_prompts_is_system" ON "prompts" USING btree ("organization_id","is_system");--> statement-breakpoint
CREATE INDEX "idx_sent_messages_session" ON "sent_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sent_messages_platform_msg" ON "sent_messages" USING btree ("platform","platform_message_id");--> statement-breakpoint
CREATE INDEX "idx_sent_messages_interaction_event" ON "sent_messages" USING btree ("interaction_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sent_messages_interaction_unique" ON "sent_messages" USING btree ("interaction_event_id");--> statement-breakpoint
CREATE INDEX "idx_tag_defs_org" ON "tag_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_telegram_file_cache_channel_media" ON "telegram_file_cache" USING btree ("channel_id","media_id");--> statement-breakpoint
CREATE INDEX "idx_telegram_file_cache_media" ON "telegram_file_cache" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "idx_test_personas_org" ON "test_personas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_variables_org" ON "variables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_variables_scope_owner" ON "variables" USING btree ("scope","owner_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_approvals_org_status" ON "workflow_approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_workflow_approvals_expires" ON "workflow_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_approvals_workflow_run" ON "workflow_approvals" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_versions_workflow" ON "workflow_versions" USING btree ("workflow_id");