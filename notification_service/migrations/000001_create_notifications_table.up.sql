CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    entity_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    to_address VARCHAR(255),
    push_token TEXT,
    push_provider VARCHAR(20),
    user_id UUID,
    status VARCHAR(20) NOT NULL,
    attempts INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_notification_recipients_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);


CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE INDEX idx_notification_recipients_notification_id ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_user_id ON notification_recipients(user_id);
CREATE INDEX idx_notification_recipients_to_address ON notification_recipients(to_address);