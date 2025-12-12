package domain

import (
	"time"
)

type Recipient struct {
	ToAddress    string `json:"to_address"`
	PushToken    string `json:"push_token,omitempty"`
	PushProvider string `json:"push_provider,omitempty"`
	UserID       string `json:"user_id"`
}

type ChatMessagePayload struct {
	FromUserID   string `json:"from_user_id"`
	FromUserName string `json:"from_user_name"`
	ToUserID     string `json:"to_user_id"`
	ToEmail      string `json:"to_email"`
	Message      string `json:"message"`
	ChatID       string `json:"chat_id"`
	MessageID    string `json:"message_id"`
}

type KafkaMessage struct {
	ID        string             `json:"id"`
	EventType string             `json:"event_type"`
	Data      ChatMessagePayload `json:"data"`
	CreatedAt time.Time          `json:"created_at"`
}

const (
	TopicNotifications    = "chat_messages"
	EventTypeNewMessage   = "new_messages"
	EntityTypeChat        = "chat"
	CategoryMessages      = "messages"
	NotificationTypeEmail = "email"
)
