package domain

import "time"

type NotificationRequest struct {
	FromAddress string                  `json:"from_address"`
	Subject     string                  `json:"subject"`
	Body        string                  `json:"body"`
	Type        string                  `json:"type"`
	Category    string                  `json:"category"`
	EntityType  string                  `json:"entity_type"`
	Recipients  []RecipientKafkaRequest `json:"recipients"`
}

type RecipientKafkaRequest struct {
	ToAddress    string `json:"to_address"`
	PushToken    string `json:"push_token"`
	PushProvider string `json:"push_provider"`
	UserID       string `json:"user_id"`
}

type KafkaMessage struct {
	ID        string              `json:"id"`
	EventType string              `json:"event_type"`
	Data      ChatMessagePayload `json:"data"`
	CreatedAt time.Time           `json:"created_at"`
}

const (
	TopicNotifications    = "chat_messages"
	EventTypeNewMessage   = "new_messages"
	EntityTypeChat        = "chat"
	CategoryMessages      = "messages"
	NotificationTypeEmail = "email"
)
