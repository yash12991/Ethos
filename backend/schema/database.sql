-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accused_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  accused_employee_hash text NOT NULL UNIQUE,
  total_complaints integer DEFAULT 0,
  guilty_count integer DEFAULT 0,
  credibility_score double precision DEFAULT 100,
  risk_level USER-DEFINED DEFAULT 'low'::risk_level_enum,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT accused_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.anonymous_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  credibility_score double precision DEFAULT 100,
  trust_flag boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  last_login timestamp without time zone,
  CONSTRAINT anonymous_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_type USER-DEFINED NOT NULL,
  user_id uuid,
  action text NOT NULL,
  ip_hash text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.complaint_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  hr_id uuid NOT NULL,
  action_type text NOT NULL,
  metadata jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT complaint_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_audit_logs_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_audit_logs_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES public.hr_users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_type USER-DEFINED NOT NULL,
  message text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id)
);
CREATE TABLE public.chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL UNIQUE,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT chat_threads_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaint_metadata (
  complaint_id uuid NOT NULL,
  device_hash text NOT NULL,
  embedding ARRAY,
  cluster_suspicion_score integer NOT NULL DEFAULT 0 CHECK (cluster_suspicion_score >= 0 AND cluster_suspicion_score <= 100),
  diversity_index integer NOT NULL DEFAULT 0 CHECK (diversity_index >= 0 AND diversity_index <= 100),
  flagged_as text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT complaint_metadata_pkey PRIMARY KEY (complaint_id),
  CONSTRAINT complaint_metadata_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_code character varying NOT NULL UNIQUE,
  anon_user_id uuid NOT NULL,
  accused_employee_hash text NOT NULL,
  incident_date date,
  location text,
  description text NOT NULL,
  status USER-DEFINED DEFAULT 'submitted'::complaint_status,
  severity_score double precision DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  rejection_type USER-DEFINED,
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_anon_user_id_fkey FOREIGN KEY (anon_user_id) REFERENCES public.anonymous_users(id)
);
CREATE TABLE public.credibility_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  anon_user_id uuid,
  complaint_id uuid,
  change_amount double precision NOT NULL,
  reason text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT credibility_history_pkey PRIMARY KEY (id),
  CONSTRAINT credibility_history_anon_user_id_fkey FOREIGN KEY (anon_user_id) REFERENCES public.anonymous_users(id),
  CONSTRAINT credibility_history_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.daily_salts (
  id integer NOT NULL DEFAULT nextval('daily_salts_id_seq'::regclass),
  salt_value text NOT NULL,
  valid_date date NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_salts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.department_risk_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  complaint_count integer DEFAULT 0,
  guilty_count integer DEFAULT 0,
  risk_score double precision DEFAULT 0,
  last_updated timestamp without time zone DEFAULT now(),
  CONSTRAINT department_risk_metrics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.evidence_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  file_url text NOT NULL,
  file_hash_sha256 text NOT NULL,
  metadata jsonb,
  uploaded_at timestamp without time zone DEFAULT now(),
  CONSTRAINT evidence_files_pkey PRIMARY KEY (id),
  CONSTRAINT evidence_files_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.hr_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email USER-DEFINED NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role USER-DEFINED NOT NULL,
  two_factor_enabled boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT hr_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.identity_vault (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  anon_user_id uuid NOT NULL UNIQUE,
  real_name text NOT NULL,
  employee_id text NOT NULL,
  email USER-DEFINED NOT NULL,
  department text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT identity_vault_pkey PRIMARY KEY (id),
  CONSTRAINT identity_vault_anon_user_id_fkey FOREIGN KEY (anon_user_id) REFERENCES public.anonymous_users(id)
);
CREATE TABLE public.suspicious_clusters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  accused_employee_hash text NOT NULL,
  cluster_suspicion_score integer NOT NULL DEFAULT 0,
  diversity_index integer NOT NULL DEFAULT 0,
  complaint_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  unique_device_count integer NOT NULL DEFAULT 0,
  similarity_cluster_count integer NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'pending'::text CHECK (review_status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suspicious_clusters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.verdicts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL UNIQUE,
  verdict USER-DEFINED NOT NULL,
  notes text,
  decided_by uuid NOT NULL,
  decided_at timestamp without time zone DEFAULT now(),
  CONSTRAINT verdicts_pkey PRIMARY KEY (id),
  CONSTRAINT verdicts_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT verdicts_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.hr_users(id)
);
