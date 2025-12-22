package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type ChatRepository struct {
	db *sqlx.DB
}

func NewChatRepository(db *sqlx.DB) *ChatRepository {
	return &ChatRepository{db: db}
}

func (r *ChatRepository) CreateChat(ctx context.Context, userId string, otherUserId string) (string, error) {
	var existingChatId string
    checkQuery := `
        SELECT id FROM direct_chats 
        WHERE (user1_id = $1 AND user2_id = $2) 
           OR (user1_id = $2 AND user2_id = $1)
        LIMIT 1
    `
    
    err := r.db.GetContext(ctx, &existingChatId, checkQuery, userId, otherUserId)
    if err == nil {
        return existingChatId, nil
    }
    if err != sql.ErrNoRows {
        return "", fmt.Errorf("failed to check existing chat: %w", err)
    }
	
	var chatId string
	query := `INSERT INTO direct_chats(user1_id, user2_id) VALUES ($1, $2) RETURNING id`
	
	row := r.db.QueryRowContext(ctx, query, userId, otherUserId)
	if err := row.Scan(&chatId); err != nil {
		return "", fmt.Errorf("failed to create chat: %w", err)
	}

	return chatId, nil
}

func (r *ChatRepository) CreateMessage(ctx context.Context, incomingMessage *domain.Message) (uuid.UUID, error) {
    var messageId uuid.UUID
    query := `INSERT INTO direct_messages(id, chat_id, sender_id, content, reply_to, message_type, is_read) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
    row := r.db.QueryRowContext(ctx, query, incomingMessage.ID, incomingMessage.ChatID, incomingMessage.SenderID,
                                    incomingMessage.Content, incomingMessage.ReplyTo, incomingMessage.MessageType,
                                    incomingMessage.IsRead)

    if err := row.Scan(&messageId); err != nil {
        return uuid.UUID{}, fmt.Errorf("failed to parse message id: %w", err)
    }

    slog.Info("new message id", "message_id", messageId)
    return messageId, nil
}

func (r *ChatRepository) GetUserChats(ctx context.Context, userId string, limit int32, offset int32) ([]domain.ChatWithLastMessage, error) {
	var chats []domain.ChatWithLastMessage
	query := `SELECT 
                dc.id, dc.user1_id, dc.user2_id, dc.created_at, dc.updated_at, dc.is_active,
                lm.id as last_message_id,
                lm.chat_id as last_message_chat_id,
                lm.sender_id as last_message_sender_id,
                lm.content as last_message_content,
                lm.reply_to as last_message_reply_to,
                lm.message_type as last_message_message_type,
                lm.created_at as last_message_created_at,
                lm.updated_at as last_message_updated_at,
                lm.deleted_at as last_message_deleted_at,
                lm.is_edited as last_message_is_edited,
                lm.is_read as last_message_is_read,
                lm.read_at as last_message_read_at
            FROM direct_chats AS dc
            LEFT JOIN LATERAL (
                SELECT *
                FROM direct_messages 
                WHERE chat_id = dc.id 
                AND deleted_at IS NULL
                ORDER BY created_at DESC 
                LIMIT 1
            ) lm ON true
            WHERE (dc.user1_id = $1 OR dc.user2_id = $1) 
            AND dc.is_active = TRUE
            ORDER BY COALESCE(lm.created_at, dc.created_at) DESC
            LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &chats, query, userId, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get chats: %w", err)
	}

	return chats, nil
}

func (r *ChatRepository) GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error) {
	var messages []domain.Message

	fetchLimit := limit + 1

	query := `
        SELECT *
        FROM direct_messages
        WHERE chat_id = $1
        AND deleted_at IS NULL
        AND (
            ($2::timestamptz IS NOT NULL AND $3::uuid IS NOT NULL AND
             (created_at < $2::timestamptz OR (created_at = $2::timestamptz AND id < $3::uuid)))
            OR
            ($2::timestamptz IS NULL AND $3::uuid IS NULL)
        )
        ORDER BY created_at ASC, id ASC
        LIMIT $4`

	var cursorTime sql.NullTime
    var cursorId sql.NullString
    
    if cursor != nil {
        cursorTime = sql.NullTime{Time: cursor.CreatedAt, Valid: true}
        cursorId = sql.NullString{String: cursor.ID.String(), Valid: true}
    }

	err := r.db.SelectContext(ctx, &messages, query, chatId, cursorTime, cursorId, fetchLimit) 
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	messagesWithAttachments, err := r.loadMessageAttachments(ctx, messages)
    if err != nil {
        return nil, fmt.Errorf("failed to load attachments: %w", err)
    }
    
	hasMore := len(messagesWithAttachments) > int(limit)
    if hasMore {
        messagesWithAttachments = messagesWithAttachments[:limit] 
    }

    slog.Info("information", "hasMore", hasMore, "message_att", messagesWithAttachments, "limit", limit, "len", len(messagesWithAttachments))

    var nextCursor *domain.Cursor
    if hasMore && len(messagesWithAttachments) > 0 {
        lastMessage := messagesWithAttachments[len(messagesWithAttachments)-1]
        nextCursor = &domain.Cursor{
            ID:        lastMessage.ID,
            CreatedAt: lastMessage.CreatedAt,
        }
    }

    slog.Info("next cursor", "next_cursor", nextCursor)
    
    return &domain.GetChatMessagesResponse{
        Messages:   messagesWithAttachments,
        NextCursor: nextCursor,
        HasMore:    hasMore,
    }, nil
}

func (r *ChatRepository) loadMessageAttachments(ctx context.Context, messages []domain.Message) ([]domain.Message, error) {
    if len(messages) == 0 {
        return messages, nil
    }

    messageIDs := make([]uuid.UUID, len(messages))
    for i, msg := range messages {
        messageIDs[i] = msg.ID
    }

    var attachments []domain.Attachment
    query := `
        SELECT id, message_id, url, file_name, mime_type, file_size, width, height, created_at
        FROM message_attachments 
        WHERE message_id = ANY($1)
        ORDER BY created_at ASC
    `
    
    err := r.db.SelectContext(ctx, &attachments, query, pq.Array(messageIDs))
    if err != nil {
        return nil, fmt.Errorf("failed to load attachments: %w", err)
    }

    attachmentsByMessage := make(map[uuid.UUID][]domain.Attachment)
    for _, att := range attachments {
        attachmentsByMessage[att.MessageID] = append(attachmentsByMessage[att.MessageID], att)
    }

    messagesWithAttachments := make([]domain.Message, len(messages))
    for i, msg := range messages {
        messagesWithAttachments[i] = msg
        if atts, exists := attachmentsByMessage[msg.ID]; exists {
            messagesWithAttachments[i].Attachments = atts
        }
    }

    return messagesWithAttachments, nil
}

func (r *ChatRepository) MarkMessagesRead(ctx context.Context, messagesIDs []string) error {
    if len(messagesIDs) == 0 {
        return nil
    }

	uuidArray := make([]uuid.UUID, len(messagesIDs))
    for i, id := range messagesIDs {
        parsedUUID, err := uuid.Parse(id)
        if err != nil {
            return fmt.Errorf("invalid message ID: %s", id)
        }
        uuidArray[i] = parsedUUID
    }

    query := `UPDATE direct_messages 
              SET is_read = TRUE, read_at = NOW() 
              WHERE id = ANY($1::uuid[])`
    
    _, err := r.db.ExecContext(ctx, query, pq.Array(uuidArray))
    if err != nil {
        return fmt.Errorf("failed to mark messages as read: %w", err)
    }

    return nil
}

func (r *ChatRepository) GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error) {
    var chat domain.ChatWithLastMessage

    query := `SELECT * FROM direct_chats WHERE id=$1`
    _ = query
    queryWithLastMess := `SELECT 
                dc.id, dc.user1_id, dc.user2_id, dc.created_at, dc.updated_at, dc.is_active,
                lm.id as last_message_id,
                lm.chat_id as last_message_chat_id,
                lm.sender_id as last_message_sender_id,
                lm.content as last_message_content,
                lm.reply_to as last_message_reply_to,
                lm.message_type as last_message_message_type,
                lm.created_at as last_message_created_at,
                lm.updated_at as last_message_updated_at,
                lm.deleted_at as last_message_deleted_at,
                lm.is_edited as last_message_is_edited,
                lm.is_read as last_message_is_read,
                lm.read_at as last_message_read_at
            FROM direct_chats AS dc
            LEFT JOIN LATERAL (
                SELECT *
                FROM direct_messages 
                WHERE chat_id = dc.id 
                AND deleted_at IS NULL
                ORDER BY created_at DESC 
                LIMIT 1
            ) lm ON true
            WHERE dc.id=$1
            AND dc.is_active = TRUE`
    err := r.db.GetContext(ctx, &chat, queryWithLastMess, chatId)
    if err != nil {
        return nil, fmt.Errorf("failed to get chat: %w", err)
    }

    return &chat, nil
}

func (r *ChatRepository) CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error) {
	var exists bool
	
	query := `
		SELECT EXISTS(
			SELECT 1 FROM direct_chats 
			WHERE id = $1 
			AND is_active = TRUE
			AND (user1_id = $2 OR user2_id = $2)
		)`
	
	err := r.db.GetContext(ctx, &exists, query, chatID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check user access to chat: %w", err)
	}
	
	return exists, nil
}

func (r *ChatRepository) ValidateMessagesInChat(ctx context.Context, chatID string, messageIDs []string) ([]string, error) {
    if len(messageIDs) == 0 {
        return nil, nil
    }

    uuidArray := make([]uuid.UUID, len(messageIDs))
    for i, id := range messageIDs {
        parsedUUID, err := uuid.Parse(id)
        if err != nil {
            return nil, fmt.Errorf("invalid message ID: %s", id)
        }
        uuidArray[i] = parsedUUID
    }

    var validMessageIDs []string
    query := `SELECT id::text FROM direct_messages 
              WHERE id = ANY($1::uuid[]) AND chat_id = $2 AND deleted_at IS NULL`
    
    err := r.db.SelectContext(ctx, &validMessageIDs, query, pq.Array(uuidArray), chatID)
    if err != nil {
        return nil, fmt.Errorf("failed to validate messages: %w", err)
    }

    return validMessageIDs, nil
}