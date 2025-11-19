package redis_handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"

	"github.com/redis/go-redis/v9"
)

type ChatService interface {
	CreateChat(ctx context.Context, userId string, otherUserId string) (string, error)
	GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error)
    GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error)
	GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error)
	MarkMessagesRead(ctx context.Context, chatId string, messagesIDs []string) error
    ProcessNewMessage(ctx context.Context, message *domain.Message) error
    CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error)
}

type RedisClient interface {
    Close() error
    Publish(ctx context.Context, channel string, message *domain.Message) error
    Subscribe(ctx context.Context, channels ...string) <-chan *redis.Message
}

type Consumer struct {
    redisClient RedisClient
    chatService ChatService
}

func NewConsumer(redisClient RedisClient, chatService ChatService) *Consumer {
    return &Consumer{
        redisClient: redisClient,
        chatService: chatService,
    }
}

func (c *Consumer) Start(ctx context.Context) {
    messages := c.redisClient.Subscribe(ctx, "new_messages")
    
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case msg := <-messages:{
                switch msg.Channel {
                    case "new_messages": {
                        slog.Info("new messages!", "message", msg)
                        c.processMessage(msg)
                    }
                }
            }  
            }
        }
    }()
}

func (c *Consumer) processMessage(redisMsg *redis.Message) {
    var message domain.Message
    if err := json.Unmarshal([]byte(redisMsg.Payload), &message); err != nil {
        slog.Error("Failed to unmarshal message", "channel", redisMsg.Channel, "error", err)
        return
    }

    slog.Info("parsed message", "message", message)
    ctx, cancel := context.WithTimeout(context.Background(), 10 * time.Second)
    defer cancel()

	err := c.chatService.ProcessNewMessage(ctx, &message)
	if err != nil {
		slog.Error("Failed to process message", "error", err)
	}
}