-- === RESET & CREATE DB ===
-- In PostgreSQL, creating/dropping databases is usually done outside the script or via specific commands.
-- dropping tables with CASCADE handles dependencies.

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_modified_column CASCADE;

-- === USERS ===
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name     VARCHAR(50)  NOT NULL,
  last_name      VARCHAR(50)  NOT NULL,
  email          VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  age            INT CHECK (age >= 0),
  phone_number   VARCHAR(20) UNIQUE,
  gender         VARCHAR(20) DEFAULT 'other' CHECK (gender IN ('male','female','other')),
  profile_image  VARCHAR(255) DEFAULT '/avatar3.png',
  last_message   VARCHAR(255) DEFAULT NULL,
  last_seen      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT NULL
);

-- Function to handle auto-update of updated_at (PostgreSQL equivalent of ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Helpful indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);

-- === CONVERSATIONS ===
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  is_group   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Merged from ALTER TABLE statements below
  title      VARCHAR(120) NULL,
  avatar_url VARCHAR(255) NULL,
  created_by INT NULL,
  CONSTRAINT fk_conv_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- === PARTICIPANTS (who is in each conversation) ===
CREATE TABLE conversation_participants (
  conversation_id      INT NOT NULL,
  user_id              INT NOT NULL,
  last_read_message_id INT NULL,
  joined_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Merged from ALTER TABLE statements below
  role                 VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_cp_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- === MESSAGES ===
CREATE TABLE messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  body            TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','seen')),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_msg_conv_created ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_conv_id ON messages(conversation_id, id);

-- === (Optional) quick sample users ===
-- INSERT INTO users (first_name,last_name,email,password_hash,age,gender,phone_number)
-- VALUES ('Alice','Doe','alice@example.com','$2b$10$hash...',22,'female','+251900000001'),
--        ('Bob','Doe','bob@example.com','$2b$10$hash...',23,'male','+251900000002');
