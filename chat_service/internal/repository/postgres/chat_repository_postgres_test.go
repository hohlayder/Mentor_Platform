package postgres

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatRepository(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	repo := NewChatRepository(sqlxDB)

	ctx := context.Background()

	t.Run("CreateChat", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			userID := uuid.New().String()
			otherUserID := uuid.New().String()
			chatID := uuid.New().String()

			mock.ExpectQuery(`SELECT id FROM direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnError(sql.ErrNoRows)

			mock.ExpectQuery(`INSERT INTO direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(chatID))

			result, err := repo.CreateChat(ctx, userID, otherUserID)

			require.NoError(t, err)
			assert.Equal(t, chatID, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("ChatAlreadyExists", func(t *testing.T) {
			userID := uuid.New().String()
			otherUserID := uuid.New().String()
			existingChatID := uuid.New().String()

			mock.ExpectQuery(`SELECT id FROM direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(existingChatID))

			result, err := repo.CreateChat(ctx, userID, otherUserID)

			require.NoError(t, err)
			assert.Equal(t, existingChatID, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("ErrorCheckingExistingChat", func(t *testing.T) {
			userID := uuid.New().String()
			otherUserID := uuid.New().String()

			mock.ExpectQuery(`SELECT id FROM direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnError(errors.New("db error"))

			result, err := repo.CreateChat(ctx, userID, otherUserID)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to check existing chat")
			assert.Empty(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("ErrorCreatingChat", func(t *testing.T) {
			userID := uuid.New().String()
			otherUserID := uuid.New().String()

			mock.ExpectQuery(`SELECT id FROM direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnError(sql.ErrNoRows)

			mock.ExpectQuery(`INSERT INTO direct_chats`).
				WithArgs(userID, otherUserID).
				WillReturnError(errors.New("insert error"))

			result, err := repo.CreateChat(ctx, userID, otherUserID)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to create chat")
			assert.Empty(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("CreateMessage", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			message := &domain.Message{
				ID:          uuid.New(),
				ChatID:      uuid.New(),
				SenderID:    uuid.New(),
				Content:     "Hello world",
				MessageType: domain.MessageTypeText,
				IsRead:      false,
			}

			mock.ExpectQuery(`INSERT INTO direct_messages`).
				WithArgs(message.ID, message.ChatID, message.SenderID, message.Content,
					message.ReplyTo, message.MessageType, message.IsRead).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(message.ID))

			result, err := repo.CreateMessage(ctx, message)

			require.NoError(t, err)
			assert.Equal(t, message.ID, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("Error", func(t *testing.T) {
			message := &domain.Message{
				ID:          uuid.New(),
				ChatID:      uuid.New(),
				SenderID:    uuid.New(),
				Content:     "Hello world",
				MessageType: domain.MessageTypeText,
				IsRead:      false,
			}

			mock.ExpectQuery(`INSERT INTO direct_messages`).
				WithArgs(message.ID, message.ChatID, message.SenderID, message.Content,
					message.ReplyTo, message.MessageType, message.IsRead).
				WillReturnError(errors.New("insert error"))

			result, err := repo.CreateMessage(ctx, message)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to parse message id")
			assert.Equal(t, uuid.UUID{}, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("GetUserChats", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			userID := uuid.New().String()
			limit := int32(10)
			offset := int32(0)

			chatID := uuid.New()
			user1ID := uuid.New()
			user2ID := uuid.New()
			messageID := uuid.New()
			createdAt := time.Now()

			rows := sqlmock.NewRows([]string{
				"id", "user1_id", "user2_id", "created_at", "updated_at", "is_active",
				"last_message_id", "last_message_chat_id", "last_message_sender_id",
				"last_message_content", "last_message_reply_to", "last_message_message_type",
				"last_message_created_at", "last_message_updated_at", "last_message_deleted_at",
				"last_message_is_edited", "last_message_is_read", "last_message_read_at",
			}).AddRow(
				chatID, user1ID, user2ID, createdAt, createdAt, true,
				messageID, chatID, user1ID, "Hello", nil, "text",
				createdAt, createdAt, nil, false, true, createdAt,
			)

			mock.ExpectQuery(`SELECT`).
				WithArgs(userID, limit, offset).
				WillReturnRows(rows)

			result, err := repo.GetUserChats(ctx, userID, limit, offset)

			require.NoError(t, err)
			require.Len(t, result, 1)
			assert.Equal(t, chatID, result[0].ID)
			assert.Equal(t, "Hello", *result[0].LastMessageContent)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("Error", func(t *testing.T) {
			userID := uuid.New().String()

			mock.ExpectQuery(`SELECT`).
				WithArgs(userID, int32(10), int32(0)).
				WillReturnError(errors.New("query error"))

			result, err := repo.GetUserChats(ctx, userID, 10, 0)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to get chats")
			assert.Nil(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("GetChatMessages", func(t *testing.T) {
		t.Run("SuccessWithoutCursor", func(t *testing.T) {
			chatID := uuid.New().String()
			limit := int32(10)

			messageID := uuid.New()
			createdAt := time.Now()

			messageRows := sqlmock.NewRows([]string{
				"id", "chat_id", "sender_id", "content", "message_type", 
				"created_at", "updated_at", "is_edited", "is_read",
			}).AddRow(
				messageID, uuid.New(), uuid.New(), "Test message", "text",
				createdAt, createdAt, false, false,
			)

			mock.ExpectQuery(`SELECT \* FROM direct_messages`).
				WithArgs(chatID, nil, nil, limit+1).
				WillReturnRows(messageRows)

			mock.ExpectQuery(`SELECT id, message_id, url, file_name, mime_type, file_size, width, height, created_at`).
				WithArgs(sqlmock.AnyArg()).
				WillReturnRows(sqlmock.NewRows([]string{
					"id", "message_id", "url", "file_name", "mime_type", "file_size", "width", "height", "created_at",
				}))

			result, err := repo.GetChatMessages(ctx, chatID, limit, nil)

			require.NoError(t, err)
			require.Len(t, result.Messages, 1)
			assert.Equal(t, messageID, result.Messages[0].ID)
			assert.False(t, result.HasMore)
			assert.Nil(t, result.NextCursor)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("SuccessWithCursor", func(t *testing.T) {
			chatID := uuid.New().String()
			limit := int32(2)
			cursor := &domain.Cursor{
				ID:        uuid.New(),
				CreatedAt: time.Now().Add(-time.Hour),
			}

			messageIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()} 

			messageRows := sqlmock.NewRows([]string{
				"id", "chat_id", "sender_id", "content", "message_type", 
				"created_at", "updated_at", "is_edited", "is_read",
			})
			for _, id := range messageIDs {
				messageRows.AddRow(
					id, uuid.New(), uuid.New(), "Test message", "text",
					time.Now(), time.Now(), false, false,
				)
			}

			mock.ExpectQuery(`SELECT \* FROM direct_messages`).
				WithArgs(chatID, cursor.CreatedAt, cursor.ID.String(), limit+1).
				WillReturnRows(messageRows)

			mock.ExpectQuery(`SELECT id, message_id, url, file_name, mime_type, file_size, width, height, created_at`).
				WithArgs(sqlmock.AnyArg()).
				WillReturnRows(sqlmock.NewRows([]string{
					"id", "message_id", "url", "file_name", "mime_type", "file_size", "width", "height", "created_at",
				}))

			result, err := repo.GetChatMessages(ctx, chatID, limit, cursor)

			require.NoError(t, err)
			assert.True(t, result.HasMore)
			assert.NotNil(t, result.NextCursor)
			assert.Equal(t, messageIDs[1], result.NextCursor.ID)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("WithAttachments", func(t *testing.T) {
			chatID := uuid.New().String()
			limit := int32(10)

			messageID := uuid.New()
			attachmentID := uuid.New()

			messageRows := sqlmock.NewRows([]string{
				"id", "chat_id", "sender_id", "content", "message_type", 
				"created_at", "updated_at", "is_edited", "is_read",
			}).AddRow(
				messageID, uuid.New(), uuid.New(), "Test message", "text",
				time.Now(), time.Now(), false, false,
			)

			mock.ExpectQuery(`SELECT \* FROM direct_messages`).
				WithArgs(chatID, nil, nil, limit+1).
				WillReturnRows(messageRows)

			// Mock вложений
			attachmentRows := sqlmock.NewRows([]string{
				"id", "message_id", "url", "file_name", "mime_type", "file_size", "width", "height", "created_at",
			}).AddRow(
				attachmentID, messageID, "http://example.com/file.jpg", "file.jpg", "image/jpeg", 1024, 800, 600, time.Now(),
			)

			mock.ExpectQuery(`SELECT id, message_id, url, file_name, mime_type, file_size, width, height, created_at`).
				WithArgs(sqlmock.AnyArg()).
				WillReturnRows(attachmentRows)

			result, err := repo.GetChatMessages(ctx, chatID, limit, nil)

			require.NoError(t, err)
			require.Len(t, result.Messages, 1)
			require.Len(t, result.Messages[0].Attachments, 1)
			assert.Equal(t, attachmentID, result.Messages[0].Attachments[0].ID)
			assert.Equal(t, "http://example.com/file.jpg", result.Messages[0].Attachments[0].URL)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("Error", func(t *testing.T) {
			chatID := uuid.New().String()

			mock.ExpectQuery(`SELECT \* FROM direct_messages`).
				WithArgs(chatID, nil, nil, int32(11)).
				WillReturnError(errors.New("query error"))

			result, err := repo.GetChatMessages(ctx, chatID, 10, nil)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to get messages")
			assert.Nil(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("MarkMessagesRead", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			messageIDs := []string{uuid.New().String(), uuid.New().String()}

			mock.ExpectExec(`UPDATE direct_messages`).
				WithArgs(sqlmock.AnyArg()).
				WillReturnResult(sqlmock.NewResult(0, 2))

			err := repo.MarkMessagesRead(ctx, messageIDs)

			require.NoError(t, err)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("EmptyList", func(t *testing.T) {
			err := repo.MarkMessagesRead(ctx, []string{})

			require.NoError(t, err)
		})

		t.Run("InvalidUUID", func(t *testing.T) {
			err := repo.MarkMessagesRead(ctx, []string{"invalid-uuid"})

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid message ID")
		})

		t.Run("Error", func(t *testing.T) {
			messageIDs := []string{uuid.New().String()}

			mock.ExpectExec(`UPDATE direct_messages`).
				WithArgs(sqlmock.AnyArg()).
				WillReturnError(errors.New("update error"))

			err := repo.MarkMessagesRead(ctx, messageIDs)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to mark messages as read")
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("GetChatById", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			chatID := uuid.New().String()

			dbChatID := uuid.New()
			user1ID := uuid.New()
			user2ID := uuid.New()
			messageID := uuid.New()
			createdAt := time.Now()

			rows := sqlmock.NewRows([]string{
				"id", "user1_id", "user2_id", "created_at", "updated_at", "is_active",
				"last_message_id", "last_message_chat_id", "last_message_sender_id",
				"last_message_content", "last_message_reply_to", "last_message_message_type",
				"last_message_created_at", "last_message_updated_at", "last_message_deleted_at",
				"last_message_is_edited", "last_message_is_read", "last_message_read_at",
			}).AddRow(
				dbChatID, user1ID, user2ID, createdAt, createdAt, true,
				messageID, dbChatID, user1ID, "Hello", nil, "text",
				createdAt, createdAt, nil, false, true, createdAt,
			)

			mock.ExpectQuery(`SELECT`).
				WithArgs(chatID).
				WillReturnRows(rows)

			result, err := repo.GetChatById(ctx, chatID)

			require.NoError(t, err)
			assert.Equal(t, dbChatID, result.ID)
			assert.Equal(t, "Hello", *result.LastMessageContent)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("NotFound", func(t *testing.T) {
			chatID := uuid.New().String()

			mock.ExpectQuery(`SELECT`).
				WithArgs(chatID).
				WillReturnError(sql.ErrNoRows)

			result, err := repo.GetChatById(ctx, chatID)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to get chat")
			assert.Nil(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("CheckUserAccessToChat", func(t *testing.T) {
		t.Run("HasAccess", func(t *testing.T) {
			chatID := uuid.New().String()
			userID := uuid.New().String()

			mock.ExpectQuery(`SELECT EXISTS`).
				WithArgs(chatID, userID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

			result, err := repo.CheckUserAccessToChat(ctx, chatID, userID)

			require.NoError(t, err)
			assert.True(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("NoAccess", func(t *testing.T) {
			chatID := uuid.New().String()
			userID := uuid.New().String()

			mock.ExpectQuery(`SELECT EXISTS`).
				WithArgs(chatID, userID).
				WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

			result, err := repo.CheckUserAccessToChat(ctx, chatID, userID)

			require.NoError(t, err)
			assert.False(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("Error", func(t *testing.T) {
			chatID := uuid.New().String()
			userID := uuid.New().String()

			mock.ExpectQuery(`SELECT EXISTS`).
				WithArgs(chatID, userID).
				WillReturnError(errors.New("query error"))

			result, err := repo.CheckUserAccessToChat(ctx, chatID, userID)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to check user access to chat")
			assert.False(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("ValidateMessagesInChat", func(t *testing.T) {
		t.Run("Success", func(t *testing.T) {
			chatID := uuid.New().String()
			messageIDs := []string{uuid.New().String(), uuid.New().String()}
			validMessageID := messageIDs[0]

			mock.ExpectQuery(`SELECT id::text FROM direct_messages`).
				WithArgs(sqlmock.AnyArg(), chatID).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(validMessageID))

			result, err := repo.ValidateMessagesInChat(ctx, chatID, messageIDs)

			require.NoError(t, err)
			require.Len(t, result, 1)
			assert.Equal(t, validMessageID, result[0])
			require.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("EmptyList", func(t *testing.T) {
			result, err := repo.ValidateMessagesInChat(ctx, "chat-id", []string{})

			require.NoError(t, err)
			assert.Nil(t, result)
		})

		t.Run("InvalidUUID", func(t *testing.T) {
			result, err := repo.ValidateMessagesInChat(ctx, "chat-id", []string{"invalid-uuid"})

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid message ID")
			assert.Nil(t, result)
		})

		t.Run("Error", func(t *testing.T) {
			chatID := uuid.New().String()
			messageIDs := []string{uuid.New().String()}

			mock.ExpectQuery(`SELECT id::text FROM direct_messages`).
				WithArgs(sqlmock.AnyArg(), chatID).
				WillReturnError(errors.New("query error"))

			result, err := repo.ValidateMessagesInChat(ctx, chatID, messageIDs)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to validate messages")
			assert.Nil(t, result)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	})
}