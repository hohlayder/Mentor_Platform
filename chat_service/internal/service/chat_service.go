package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
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

type UserClient interface {
    CreateUser(ctx context.Context, in *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error)
    GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error)
    GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error)
    DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error)
    GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error)
    UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error)
    UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest) (*userv1.UploadAvatarResponse, error)
    DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest) (*userv1.DeleteAvatarResponse, error)
}

type NotificationProducer interface {
    SendEmailNotification(ctx context.Context, req domain.ChatMessagePayload) error
    SendNewMessageNotification(ctx context.Context, senderID, SenderEmail, recipientID, chatID, messageContent string, messageId string) error
    Close() error
}


type ChatService struct {
	repo ChatRepositrory
	client UserClient
	producer NotificationProducer
}

func NewChatService(repo ChatRepositrory, client UserClient, producer NotificationProducer) *ChatService {
	return &ChatService{
		repo: repo,
		client: client,
		producer: producer,
	}
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
	slog.Info("process message start")
	if message.MessageType == "" {
		message.MessageType = "text"
	}

	messageId, err := s.repo.CreateMessage(ctx, message)
	if err != nil {
		slog.Error("failed to save message")
		return fmt.Errorf("failed to create message: %w", err)
	}

	chat, err := s.repo.GetChatById(ctx, message.ChatID.String())
	if err != nil {
		slog.Error("failed to get chat while save messgae")
		return fmt.Errorf("failed to get chat while save message: %w", err)
	}

	var recipientId string
    if chat.User1ID == message.SenderID {
        recipientId = chat.User2ID.String()
    } else {
        recipientId = chat.User1ID.String()
    }

	resp, err := s.client.GetUserById(ctx, generateUserServiceProtoRequest(recipientId))
	if err != nil {
		slog.Error("failed to get user", "error", err)
		return fmt.Errorf("failed to get user email while process new message: %w", err)
	}

	go func() {
        notificationCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        slog.Info("start send")
        err := s.producer.SendNewMessageNotification(
            notificationCtx,
            message.SenderID.String(),
			resp.User.Email,
            recipientId,
            message.ChatID.String(),
            message.Content,
			messageId.String(),
        )
        if err != nil {
            slog.Error("Failed to send email notification", "error", err)
        } else {
            slog.Info("Email notification sent for message to user", 
						"message_id", message.ID, "recipient_id", recipientId, 
						"email", resp.User.Email)
        }
    }()
    
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

func generateUserServiceProtoRequest(userId string) *userv1.GetUserByIdRequest{
	return &userv1.GetUserByIdRequest{
		UserId: userId,
	}
}