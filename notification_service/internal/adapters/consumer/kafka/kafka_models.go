package kafka

import "time"


type NotificationRequest struct {
	FromAddress   string    `json:"from_address"`
	Subject       string    `json:"subject"`
	Body          string    `json:"body"`
	Type          string    `json:"type"`
	Category      string    `json:"category"`
	EntityType    string    `json:"entity_type"`
	Recipients    []Recipient `json:"recipients"`
}

type Recipient struct {
	ToAddress   string `json:"to_address"`
	PushToken   string `json:"push_token"`
	PushProvider string `json:"push_provider"`
	UserID      string `json:"user_id"`
}

type KafkaMessage struct {
	ID        string              `json:"id"`
	EventType string              `json:"event_type"`
	Data      NotificationRequest `json:"data"`
	CreatedAt time.Time           `json:"created_at"`
}