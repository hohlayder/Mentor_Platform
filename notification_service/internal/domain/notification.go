package domain

import (
	"time"

	"github.com/google/uuid"
)

type NotificationStatus string

const (
	NotificationStatusPending  NotificationStatus = "pending"
	NotificationStatusSent     NotificationStatus = "sent"
	NotificationStatusFailed   NotificationStatus = "failed"
	NotificationStatusCanceled NotificationStatus = "canceled"
)

type PushProvider string

const (
	PushProviderAPNS    PushProvider = "apns"
	PushProviderFCM     PushProvider = "fcm"
	PushProviderWebPush PushProvider = "webpush"
)

type Notification struct {
	ID          uuid.UUID          `json:"id" db:"id"`
	FromAddress string             `json:"from_address" db:"from_address"`
	Subject     string             `json:"subject" db:"subject"`
	Body        string             `json:"body" db:"body"`
	Status      NotificationStatus `json:"status" db:"status"`
	Type        string             `json:"type" db:"type"`
	Category    *string            `json:"category" db:"category"`
	EntityType  *string            `json:"entity_type" db:"entity_type"`
	CreatedAt   time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" db:"updated_at"`
	Recipients  []Recipient        `json:"recipients,omitempty"`
}

type Recipient struct {
	ID             uuid.UUID          `json:"id" db:"id"`
	NotificationID uuid.UUID          `json:"notification_id" db:"notification_id"`
	ToAddress      *string            `json:"to_address" db:"to_address"`
	PushToken      *string            `json:"push_token" db:"push_token"`
	PushProvider   *PushProvider      `json:"push_provider" db:"push_provider"`
	UserID         *uuid.UUID         `json:"user_id" db:"user_id"`
	Attempts       int                `json:"attempts" db:"attempts"`
	MaxAttempts    int                `json:"max_attempts" db:"max_attempts"`
	Status         NotificationStatus `json:"status" db:"status"`
	ErrorMessage   *string            `json:"error_message" db:"error_message"`
	SentAt         *time.Time         `json:"sent_at" db:"sent_at"`
	CreatedAt      time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at" db:"updated_at"`
}

type NotificationUpdate struct {
	ID          uuid.UUID
	FromAddress *string
	Subject     *string
	Body        *string
	Status      *NotificationStatus
	Attempts    *int
	MaxAttempts *int
	Type        *string
	Category    *string
	EntityType  *string
	Recipients  *[]Recipient
}

type CreateNotificationRequest struct {
	FromAddress string             `json:"from_address" validate:"required,email"`
	Subject     string             `json:"subject" validate:"required"`
	Body        string             `json:"body" validate:"required"`
	Type        string             `json:"type" validate:"required"`
	Category    *string            `json:"category"`
	EntityType  *string            `json:"entity_type"`
	MaxAttempts int                `json:"max_attempts" validate:"min=1"`
	Recipients  []RecipientRequest `json:"recipients" validate:"required,min=1"`
}

type RecipientRequest struct {
	ToAddress    *string       `json:"to_address" validate:"omitempty,email"`
	PushToken    *string       `json:"push_token"`
	PushProvider *PushProvider `json:"push_provider"`
	UserID       *uuid.UUID    `json:"user_id"`
}

type ChatMessagePayload struct {
	FromUserID   uuid.UUID `json:"from_user_id"`
	FromUserName string    `json:"from_user_name"`
	ToUserID     uuid.UUID `json:"to_user_id"`
	ToEmail      string    `json:"to_email"`
	Message      string    `json:"message"`
	ChatID       uuid.UUID `json:"chat_id"`
	MessageID    uuid.UUID `json:"message_id"`
}

type PasswordResetPayload struct {
	UserID    uuid.UUID `json:"user_id"`
	UserEmail string    `json:"user_email"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}
