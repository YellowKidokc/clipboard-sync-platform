-- SQL backup generated from Drizzle schema. Use drizzle-kit push in practice.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  hashed_password text NOT NULL,
  api_key text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  platform text NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  path_template text NOT NULL
);

CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  device_id uuid REFERENCES devices(id),
  content_type text NOT NULL,
  text_content text,
  blob_url text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  folder_id uuid REFERENCES folders(id),
  is_pinned boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  hotkey_slot integer,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  match_type text NOT NULL,
  pattern text NOT NULL,
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  predicted_content text NOT NULL,
  actual_content text,
  confidence real NOT NULL,
  was_correct boolean,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prediction_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  window_size integer NOT NULL DEFAULT 100,
  accuracy real NOT NULL DEFAULT 0,
  total_predictions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  clip_id uuid REFERENCES clips(id),
  role text NOT NULL,
  content text NOT NULL,
  workflow text,
  created_at timestamp NOT NULL DEFAULT now()
);
