package domain

import (
	"time"

	"github.com/google/uuid"
)

type MessageType string

const (
	MessageTypeText  MessageType = "text"
	MessageTypeImage MessageType = "image"
	MessageTypeFile  MessageType = "file"
	MessageTypeVoice MessageType = "voice"
)

type CreateChatRequest struct {
	OtherUserID string `json:"other_user_id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174001"`
}

type CreateChatResponse struct {
	ChatID string `json:"chat_id" example:"123e4567-e89b-12d3-a456-426614174002"`
}

type GetUserChatsRequest struct {
	Limit  int32 `form:"limit,default=20" example:"20"`
	Offset int32 `form:"offset,default=0" example:"0"`
}

type ChatResponse struct {
	ID          string    `json:"id" example:"123e4567-e89b-12d3-a456-426614174002"`
	User1ID     string    `json:"user1_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	User2ID     string    `json:"user2_id" example:"123e4567-e89b-12d3-a456-426614174001"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	UnreadCount int32     `json:"unread_count" example:"5"`
	LastMessage *Message  `json:"last_message,omitempty"`
}

type GetUserChatsResponse struct {
	Chats []ChatResponse `json:"chats"`
}

type GetChatByIdResponse struct {
	Chat ChatResponse `json:"chat"`
}

type GetChatMessagesRequest struct {
	ChatID string `form:"chat_id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174002"`
	Limit  int32  `form:"limit,default=50" example:"50"`
	Cursor string `form:"cursor" example:"eyJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCIsImNyZWF0ZWRfYXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiJ9"`
}

type Cursor struct {
	ID        string    `json:"id" example:"123e4567-e89b-12d3-a456-426614174004"`
	CreatedAt time.Time `json:"created_at"`
}

type GetChatMessagesResponse struct {
	Messages   []Message `json:"messages"`
	NextCursor *Cursor   `json:"next_cursor,omitempty"`
	HasMore    bool      `json:"has_more" example:"true"`
}

type MarkMessagesReadRequest struct {
	ChatId     string   `json:"chat_id"`
	MessageIDs []string `json:"message_ids" binding:"required" example:"[\"123e4567-e89b-12d3-a456-426614174004\",\"123e4567-e89b-12d3-a456-426614174005\"]"`
}

type MarkMessagesReadResponse struct {
	Success bool `json:"success" example:"true"`
}

type UserAccessCheck struct {
	ChatID    string
	UserID    string
	HasAccess bool
}

type UserAccessCheckRequest struct {
	ChatID string
	UserID string
}

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

type Message struct {
	ID          uuid.UUID    `json:"id"`
	ChatID      uuid.UUID    `json:"chat_id"`
	SenderID    uuid.UUID    `json:"sender_id"`
	Content     string       `json:"content"`
	ReplyTo     *uuid.UUID   `json:"reply_to,omitempty"`
	MessageType MessageType  `json:"message_type"`
	Attachments []Attachment `json:"attachments,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	DeletedAt   *time.Time   `json:"deleted_at,omitempty"`
	IsEdited    bool         `json:"is_edited"`
	IsRead      bool         `json:"is_read"`
	ReadAt      *time.Time   `json:"read_at,omitempty"`
}

type Attachment struct {
	ID        uuid.UUID `json:"id"`
	MessageID uuid.UUID `json:"message_id"`
	URL       string    `json:"url"`
	FileName  string    `json:"file_name"`
	MimeType  string    `json:"mime_type"`
	FileSize  int64     `json:"file_size"`
	Width     *int      `json:"width,omitempty"`
	Height    *int      `json:"height,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Client struct {
	ID        string    `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	IPAddress string    `json:"ip_address"`
	Connected time.Time `json:"connected"`
	LastSeen  time.Time `json:"last_seen"`
}
