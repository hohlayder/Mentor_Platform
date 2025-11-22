package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
)

type DefaultLimit int32

const defaultLimit DefaultLimit = 50

type ChatRepositrory interface {
	CreateChat(ctx context.Context, userId string, otherUserId string) (string, error)
	CreateMessage(ctx context.Context, incomingMessage *domain.Message) (uuid.UUID, error)
	GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error)
	GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error)
	GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error)
	MarkMessagesRead(ctx context.Context, messagesIDs []string) error
	CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error)
	ValidateMessagesInChat(ctx context.Context, chatID string, messageIDs []string) ([]string, error) 
}

type ChatService struct {
	repo ChatRepositrory
}

func NewChatService(repo ChatRepositrory) *ChatService {
	return &ChatService{repo: repo}
}

func (s *ChatService) CreateChat(ctx context.Context, userId string, otherUserId string) (string, error) {
	return s.repo.CreateChat(ctx, userId, otherUserId)
}

func (s *ChatService) GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error) {
	if limit <= 0 || limit >= 200 {
		limit = int32(defaultLimit)
	}

	return s.repo.GetUserChats(ctx, userId, limit, before)
}

func (s *ChatService) GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error) {
	if limit <= 0 || limit >= 200 {
		limit = int32(defaultLimit)
	}

	return s.repo.GetChatMessages(ctx, chatId, limit, cursor)
}

func (s *ChatService) GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error) {
	return s.repo.GetChatById(ctx, chatId)
}

func (s *ChatService) ProcessNewMessage(ctx context.Context, message *domain.Message) error {
	if message.MessageType == "" {
		message.MessageType = "text"
	}
	_, err := s.repo.CreateMessage(ctx, message)

	if err != nil {
		slog.Error("failed to save message")
		return fmt.Errorf("failed to create message: %w", err)
	}
	return nil
}

func (s *ChatService) CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error) {
	if chatID == "" || userID == "" {
		return false, domain.ErrInvalidChatID
	}

	hasAccess, err := s.repo.CheckUserAccessToChat(ctx, chatID, userID)
	if err != nil {
		slog.Error("failed to check user access to chat", "error", err, "chat_id", chatID, "user_id", userID)
		return false, fmt.Errorf("failed to check user access: %w", err)
	}

	return hasAccess, nil
}

func (s *ChatService) MarkMessagesRead(ctx context.Context, chatID string, messageIDs []string) error {
    validMessages, err := s.repo.ValidateMessagesInChat(ctx, chatID, messageIDs)
    if err != nil {
        return fmt.Errorf("failed to validate messages: %w", err)
    }

    return s.repo.MarkMessagesRead(ctx, validMessages)
}