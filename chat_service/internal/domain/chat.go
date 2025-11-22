package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrChatNotFound  = errors.New("chat not found")
	ErrAccessDenied  = errors.New("access denied to chat")
	ErrInvalidChatID = errors.New("invalid chat id")
)

type ChatWithLastMessage struct {
	ID        uuid.UUID `db:"id"`
	User1ID   uuid.UUID `db:"user1_id"`
	User2ID   uuid.UUID `db:"user2_id"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
	IsActive  bool      `db:"is_active"`

	LastMessageID        *uuid.UUID `db:"last_message_id"`
	LastMessageChatID    *uuid.UUID `db:"last_message_chat_id"`
	LastMessageSenderID  *uuid.UUID `db:"last_message_sender_id"`
	LastMessageContent   *string    `db:"last_message_content"`
	LastMessageReplyTo   *uuid.UUID `db:"last_message_reply_to"`
	LastMessageType      *string    `db:"last_message_message_type"`
	LastMessageCreatedAt *time.Time `db:"last_message_created_at"`
	LastMessageUpdatedAt *time.Time `db:"last_message_updated_at"`
	LastMessageDeletedAt *time.Time `db:"last_message_deleted_at"`
	LastMessageIsEdited  *bool      `db:"last_message_is_edited"`
	LastMessageIsRead    *bool      `db:"last_message_is_read"`
	LastMessageReadAt    *time.Time `db:"last_message_read_at"`
}

type Chat struct {
	ID        uuid.UUID `db:"id"`
	User1ID   uuid.UUID `db:"user1_id"`
	User2ID   uuid.UUID `db:"user2_id"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
	IsActive  bool      `db:"is_active"`
}

type Message struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	ChatID      uuid.UUID   `json:"chat_id" db:"chat_id"`
	SenderID    uuid.UUID   `json:"sender_id" db:"sender_id"`
	Content     string      `json:"content" db:"content"`
	ReplyTo     *uuid.UUID  `json:"reply_to" db:"reply_to"`
	MessageType MessageType `json:"message_type" db:"message_type"`
	Attachments []Attachment
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at" db:"deleted_at"`
	IsEdited    bool       `json:"is_edited" db:"is_edited"`
	IsRead      bool       `json:"is_read" db:"is_read"`
	ReadAt      *time.Time `json:"read_at" db:"read_at"`
}

type Attachment struct {
	ID        uuid.UUID `db:"id"`
	MessageID uuid.UUID `db:"message_id"`
	URL       string    `db:"url"`
	FileName  string    `db:"file_name"`
	MimeType  string    `db:"mime_type"`
	FileSize  int64     `db:"file_size"`
	Width     *int      `db:"width"`
	Height    *int      `db:"height"`
	CreatedAt time.Time `db:"created_at"`
}

type GetChatMessagesResponse struct {
	Messages   []Message
	NextCursor *Cursor
	HasMore    bool
}

type MessageType string

const (
	MessageTypeText  MessageType = "text"
	MessageTypeImage MessageType = "image"
	MessageTypeFile  MessageType = "file"
	MessageTypeVideo MessageType = "video"
	MessageTypeAudio MessageType = "audio"
)
