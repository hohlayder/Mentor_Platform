package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/client"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/infrastructure/redis"
)

type MessageBroker interface {
	Publish(ctx context.Context, channel string, message interface{}) error
}

type ChatCache interface {
	SetChat(chatID, user1ID, user2ID string) error
	GetChat(chatID string) (*redis.ChatUsers, error)
	DeleteChat(chatID string) error
}

type MessageService struct {
	clientRepo    ClientRepository
	messageBroker MessageBroker
	chatClient client.ChatClient
	chatCache ChatCache
}

func NewMessageService(clientRepo ClientRepository, 
		messageBroker MessageBroker, 
		chatClient client.ChatClient, 
		chatCache ChatCache) *MessageService {
	return &MessageService{
		clientRepo:    clientRepo,
		messageBroker: messageBroker,
		chatClient: chatClient,
		chatCache: chatCache,
	}
}

func (s *MessageService) ValidateMessage(message *domain.Message) error {
	if strings.TrimSpace(message.Content) == "" && len(message.Attachments) == 0 {
		return fmt.Errorf("message must have content or attachments")
	}
	
	if message.ChatID == uuid.Nil {
		return fmt.Errorf("chat_id is required")
	}
	
	if message.SenderID == uuid.Nil {
		return fmt.Errorf("sender_id is required")
	}
	
	if len(message.Content) > 4000 {
		return fmt.Errorf("message too long")
	}
	
	for _, attachment := range message.Attachments {
		if attachment.URL == "" {
			return fmt.Errorf("attachment url is required")
		}
		if attachment.FileName == "" {
			return fmt.Errorf("attachment file_name is required")
		}
	}
	
	return nil
}

func (s *MessageService) SendMessageInstantly(message *domain.Message) error {
	if err := s.ValidateMessage(message); err != nil {
		return err
	}

	if message.ID == uuid.Nil {
		message.ID = uuid.New()
	}
	if message.CreatedAt.IsZero() {
		message.CreatedAt = time.Now()
	}

	message.UpdatedAt = time.Now()
	message.IsEdited = false
	message.IsRead = false

	recipientID, err := s.determineRecipient(message.ChatID, message.SenderID)
	if err != nil {
		return fmt.Errorf("failed to determine recipient: %w", err)
	}

	if err := s.clientRepo.SendMessage(recipientID, message); err != nil {
		if strings.Contains(err.Error(), fmt.Sprintf("user %s is not connected", recipientID.String())) {
			slog.Info("recipient is not connected")
		} else {
			return fmt.Errorf("failed to send message to recipient: %w", err)
		}
	} else {
		message.IsRead = true
	}

	if err := s.clientRepo.SendMessage(message.SenderID, message); err != nil {
		return fmt.Errorf("failed to send confirmation to sender: %w", err)
	}

	go s.sendForPersistence(message)

	return nil
}

func (s *MessageService) determineRecipient(chatID uuid.UUID, senderID uuid.UUID) (uuid.UUID, error) {
	chatUsers, err := s.chatCache.GetChat(chatID.String())
	if err != nil {
		slog.Warn("cache get failed, falling back to service", 
            "chat_id", chatID, "error", err)
	}

	if chatUsers != nil {
		if chatUsers.User1ID != senderID.String() && chatUsers.User2ID != senderID.String() {
			return uuid.UUID{}, fmt.Errorf("user not a member of chat")
		}
		return GetRecipientID(chatUsers.User1ID, chatUsers.User2ID, senderID)
	}
	
	
	req := chatv1.GetChatByIdRequest{
		Id: chatID.String(),
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	respGetChat, err := s.chatClient.Client.GetChatById(ctx, &req)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("failed to get chat by id: %w", err)
	}
	
	if err := s.chatCache.SetChat(chatID.String(), respGetChat.Chat.User1Id, respGetChat.Chat.User2Id); err != nil {
		slog.Warn("failed to save to cache information about chat", "error", err)
	}

	return GetRecipientID(respGetChat.Chat.User1Id, respGetChat.Chat.User2Id, senderID)
}

func GetRecipientID(user1Id, user2Id string, senderID uuid.UUID) (uuid.UUID, error) {
	user1IdUUID, err := uuid.Parse(user1Id)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("failed parse userId: %w", err)
	}

	user2IdUUID, err := uuid.Parse(user2Id)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("failed parse userId: %w", err)
	}

	if user1IdUUID == senderID {
		return user2IdUUID, nil
	}

	return user1IdUUID, nil
}

func (s *MessageService) sendForPersistence(message *domain.Message) {
	ctx := context.Background()
	slog.Info("send for persistence start", "message", message)
	if err := s.messageBroker.Publish(ctx, "new_messages", message); err != nil {
		slog.Warn("Failed to send message for persistence", "error", err, "message_id", message.ID)
	}
}
