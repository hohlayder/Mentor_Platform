CREATE TABLE direct_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL, 
    user2_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CHECK (user1_id != user2_id)
);

CREATE OR REPLACE FUNCTION check_chat_unique()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM direct_chats 
        WHERE (user1_id = NEW.user1_id AND user2_id = NEW.user2_id)
           OR (user1_id = NEW.user2_id AND user2_id = NEW.user1_id)
    ) THEN
        RAISE EXCEPTION 'Chat between these users already exists';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_chat_unique_trigger
    BEFORE INSERT ON direct_chats
    FOR EACH ROW EXECUTE FUNCTION check_chat_unique();

CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES direct_chats(id) ON DELETE CASCADE, 
    sender_id UUID NOT NULL, 
    content TEXT NOT NULL,
    reply_to UUID REFERENCES direct_messages(id) ON DELETE SET NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'video', 'audio')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_direct_messages_chat_id ON direct_messages(chat_id);
CREATE INDEX idx_direct_messages_created_at ON direct_messages(created_at);
CREATE INDEX idx_direct_messages_reply_to ON direct_messages(reply_to) WHERE reply_to IS NOT NULL;
CREATE INDEX idx_direct_messages_sender_id ON direct_messages(sender_id);

CREATE INDEX idx_direct_chats_user1 ON direct_chats(user1_id) WHERE is_active = true;
CREATE INDEX idx_direct_chats_user2 ON direct_chats(user2_id) WHERE is_active = true;
CREATE INDEX idx_direct_chats_updated ON direct_chats(updated_at DESC);

CREATE INDEX idx_attachments_message_id ON message_attachments(message_id);