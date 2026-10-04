CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disease VARCHAR(32) NOT NULL CHECK (disease IN ('heart', 'diabetes', 'lung')),
  input_data JSONB NOT NULL,
  risk_percentage NUMERIC(5,2) NOT NULL CHECK (risk_percentage >= 0 AND risk_percentage <= 100),
  risk_level VARCHAR(32) NOT NULL,
  model_version VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disease VARCHAR(32) NOT NULL CHECK (disease IN ('heart', 'lung', 'diabetes')),
  input_data JSONB NOT NULL,
  derived_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_percentage NUMERIC(5,2),
  risk_level VARCHAR(16),
  model_version VARCHAR(100),
  model_status VARCHAR(40) NOT NULL DEFAULT 'disabled_awaiting_compatible_dataset',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
  clinical_intake_id UUID REFERENCES clinical_intakes(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL DEFAULT 'Health conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES predictions(id) ON DELETE SET NULL,
  clinical_intake_id UUID REFERENCES clinical_intakes(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  file_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size >= 0),
  file_path TEXT NOT NULL,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(16) NOT NULL CHECK (sender IN ('user', 'assistant')),
  message TEXT NOT NULL,
  attachment_id UUID REFERENCES medical_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE predictions ALTER COLUMN risk_level TYPE VARCHAR(32);
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS clinical_intake_id UUID REFERENCES clinical_intakes(id) ON DELETE CASCADE;
ALTER TABLE medical_files
  ADD COLUMN IF NOT EXISTS clinical_intake_id UUID REFERENCES clinical_intakes(id) ON DELETE CASCADE;
ALTER TABLE clinical_intakes
  ADD COLUMN IF NOT EXISTS risk_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(16),
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_user_created ON predictions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_medical_files_user_id ON medical_files(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_files_user_created ON medical_files(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_one_prediction
  ON chat_sessions(prediction_id)
  WHERE prediction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_one_intake
  ON chat_sessions(clinical_intake_id)
  WHERE clinical_intake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_intakes_user_created
  ON clinical_intakes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_files_intake_id
  ON medical_files(clinical_intake_id);

INSERT INTO chat_sessions (user_id, clinical_intake_id, title)
SELECT ci.user_id, ci.id, INITCAP(ci.disease) || ' clinical intake'
FROM clinical_intakes ci
WHERE NOT EXISTS (
  SELECT 1 FROM chat_sessions cs
  WHERE cs.clinical_intake_id = ci.id AND cs.user_id = ci.user_id
);
