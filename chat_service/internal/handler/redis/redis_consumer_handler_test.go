package redis_handler

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type MockRedisClient struct {
	mock.Mock
}

func (m *MockRedisClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRedisClient) Publish(ctx context.Context, channel string, message *domain.Message) error {
	args := m.Called(ctx, channel, message)
	return args.Error(0)
}

func (m *MockRedisClient) Subscribe(ctx context.Context, channels ...string) <-chan *redis.Message {
	args := m.Called(ctx, channels)
	return args.Get(0).(<-chan *redis.Message)
}

// MockChatService реализует ChatService интерфейс
type MockChatService struct {
	mock.Mock
}

func (m *MockChatService) CreateChat(ctx context.Context, userId string, otherUserId string) (string, error) {
	args := m.Called(ctx, userId, otherUserId)
	return args.String(0), args.Error(1)
}

func (m *MockChatService) GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error) {
	args := m.Called(ctx, userId, limit, before)
	return args.Get(0).([]domain.ChatWithLastMessage), args.Error(1)
}

func (m *MockChatService) GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error) {
	args := m.Called(ctx, chatId)
	return args.Get(0).(*domain.ChatWithLastMessage), args.Error(1)
}

func (m *MockChatService) GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error) {
	args := m.Called(ctx, chatId, limit, cursor)
	return args.Get(0).(*domain.GetChatMessagesResponse), args.Error(1)
}

func (m *MockChatService) MarkMessagesRead(ctx context.Context, chatId string, messagesIDs []string) error {
	args := m.Called(ctx, chatId, messagesIDs)
	return args.Error(0)
}

func (m *MockChatService) ProcessNewMessage(ctx context.Context, message *domain.Message) error {
	args := m.Called(ctx, message)
	return args.Error(0)
}

func (m *MockChatService) CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error) {
	args := m.Called(ctx, chatID, userID)
	return args.Bool(0), args.Error(1)
}

func TestConsumer_Start(t *testing.T) {
	t.Run("successful startup and message processing", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		messagesChan := make(chan *redis.Message)
		
		redisClient.On("Subscribe", mock.Anything, []string{"new_messages"}).
			Return((<-chan *redis.Message)(messagesChan))

		consumer := NewConsumer(redisClient, chatService)
		ctx, cancel := context.WithCancel(context.Background())

		consumerDone := make(chan struct{})
		go func() {
			consumer.Start(ctx)
			close(consumerDone)
		}()


		time.Sleep(50 * time.Millisecond)

		redisClient.AssertCalled(t, "Subscribe", mock.Anything, []string{"new_messages"})

		cancel()

		select {
		case <-consumerDone:
		case <-time.After(100 * time.Millisecond):
			t.Error("Consumer did not stop in time")
		}
	})

	t.Run("process multiple messages", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		messagesChan := make(chan *redis.Message, 3)
		
		redisClient.On("Subscribe", mock.Anything, []string{"new_messages"}).
			Return((<-chan *redis.Message)(messagesChan))

		consumer := NewConsumer(redisClient, chatService)
		ctx, cancel := context.WithCancel(context.Background())

		var wg sync.WaitGroup
		
		messageID1 := uuid.New()
		messageID2 := uuid.New()
		messageID3 := uuid.New()
		userID1 := uuid.New()
		userID2 := uuid.New()
		userID3 := uuid.New()
		chatID := uuid.New()

		testMessages := []domain.Message{
			{
				ID:          messageID1,
				ChatID:      chatID,
				SenderID:    userID1,
				Content:     "Message 1",
				MessageType: domain.MessageTypeText,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
				IsEdited:    false,
				IsRead:      false,
			},
			{
				ID:          messageID2,
				ChatID:      chatID,
				SenderID:    userID2,
				Content:     "Message 2",
				MessageType: domain.MessageTypeText,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
				IsEdited:    false,
				IsRead:      false,
			},
			{
				ID:          messageID3,
				ChatID:      chatID,
				SenderID:    userID3,
				Content:     "Message 3",
				MessageType: domain.MessageTypeText,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
				IsEdited:    false,
				IsRead:      false,
			},
		}


		for i := range testMessages {
			wg.Add(1)
			msg := testMessages[i] 
			chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
				mock.MatchedBy(func(m *domain.Message) bool {
					return m.ID == msg.ID
				})).Return(nil).Once().Run(func(args mock.Arguments) {
					wg.Done()
				})
		}

		consumerDone := make(chan struct{})
		go func() {
			consumer.Start(ctx)
			close(consumerDone)
		}()

		time.Sleep(50 * time.Millisecond)

		for i := range testMessages {
			messageJSON, err := json.Marshal(testMessages[i])
			require.NoError(t, err)
			
			messagesChan <- &redis.Message{
				Channel: "new_messages",
				Payload: string(messageJSON),
			}
		}

		wg.Wait()

		cancel()

		close(messagesChan)

		select {
		case <-consumerDone:
		case <-time.After(100 * time.Millisecond):
			t.Error("Consumer did not stop in time")
		}

		chatService.AssertNumberOfCalls(t, "ProcessNewMessage", len(testMessages))
	})

	t.Run("graceful shutdown on context cancellation", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		messagesChan := make(chan *redis.Message)
		
		redisClient.On("Subscribe", mock.Anything, []string{"new_messages"}).
			Return((<-chan *redis.Message)(messagesChan))

		consumer := NewConsumer(redisClient, chatService)
		ctx, cancel := context.WithCancel(context.Background())

		consumerDone := make(chan struct{})
		go func() {
			consumer.Start(ctx)
			close(consumerDone)
		}()

		time.Sleep(50 * time.Millisecond)

		cancel()

		select {
		case <-consumerDone:

		case <-time.After(100 * time.Millisecond):
			t.Error("Consumer did not stop in time")
		}

		redisClient.AssertCalled(t, "Subscribe", mock.Anything, []string{"new_messages"})
	})
}

func TestConsumer_processMessage(t *testing.T) {
	t.Run("successful message processing", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		messageID := uuid.New()
		chatID := uuid.New()
		senderID := uuid.New()

		testMessage := domain.Message{
			ID:          messageID,
			ChatID:      chatID,
			SenderID:    senderID,
			Content:     "Hello, World!",
			MessageType: domain.MessageTypeText,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsEdited:    false,
			IsRead:      false,
		}

		messageJSON, err := json.Marshal(testMessage)
		require.NoError(t, err)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: string(messageJSON),
		}

		chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID &&
					msg.ChatID == chatID &&
					msg.SenderID == senderID &&
					msg.Content == "Hello, World!" &&
					msg.MessageType == domain.MessageTypeText
			})).Return(nil)

		consumer.processMessage(redisMsg)

		chatService.AssertCalled(t, "ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID
			}))
	})

	t.Run("successful message with reply", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		messageID := uuid.New()
		chatID := uuid.New()
		senderID := uuid.New()
		replyToID := uuid.New()

		testMessage := domain.Message{
			ID:          messageID,
			ChatID:      chatID,
			SenderID:    senderID,
			Content:     "This is a reply",
			ReplyTo:     &replyToID,
			MessageType: domain.MessageTypeText,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsEdited:    false,
			IsRead:      false,
		}

		messageJSON, err := json.Marshal(testMessage)
		require.NoError(t, err)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: string(messageJSON),
		}

		chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID &&
					msg.ChatID == chatID &&
					msg.SenderID == senderID &&
					msg.Content == "This is a reply" &&
					msg.ReplyTo != nil &&
					*msg.ReplyTo == replyToID
			})).Return(nil)

		consumer.processMessage(redisMsg)

		chatService.AssertCalled(t, "ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID && msg.ReplyTo != nil && *msg.ReplyTo == replyToID
			}))
	})

	t.Run("invalid JSON payload", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: "invalid json {",
		}

		consumer.processMessage(redisMsg)

		chatService.AssertNotCalled(t, "ProcessNewMessage", mock.Anything, mock.Anything)
	})

	t.Run("chat service returns error", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		messageID := uuid.New()
		chatID := uuid.New()
		senderID := uuid.New()

		testMessage := domain.Message{
			ID:          messageID,
			ChatID:      chatID,
			SenderID:    senderID,
			Content:     "Error message",
			MessageType: domain.MessageTypeText,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsEdited:    false,
			IsRead:      false,
		}

		messageJSON, err := json.Marshal(testMessage)
		require.NoError(t, err)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: string(messageJSON),
		}

		expectedErr := errors.New("database error")
		
		chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID &&
					msg.Content == "Error message"
			})).Return(expectedErr)

		consumer.processMessage(redisMsg)

		chatService.AssertCalled(t, "ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID
			}))
	})

	t.Run("message with read status", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		messageID := uuid.New()
		chatID := uuid.New()
		senderID := uuid.New()
		readAt := time.Now()

		testMessage := domain.Message{
			ID:          messageID,
			ChatID:      chatID,
			SenderID:    senderID,
			Content:     "Read message",
			MessageType: domain.MessageTypeText,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsEdited:    false,
			IsRead:      true,
			ReadAt:      &readAt,
		}

		messageJSON, err := json.Marshal(testMessage)
		require.NoError(t, err)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: string(messageJSON),
		}

		chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID &&
					msg.Content == "Read message" &&
					msg.IsRead == true &&
					msg.ReadAt != nil
			})).Return(nil)

		consumer.processMessage(redisMsg)

		chatService.AssertCalled(t, "ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), 
			mock.MatchedBy(func(msg *domain.Message) bool {
				return msg.ID == messageID && msg.IsRead == true
			}))
	})

	t.Run("empty message payload", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: "",
		}

		consumer.processMessage(redisMsg)

		chatService.AssertNotCalled(t, "ProcessNewMessage", mock.Anything, mock.Anything)
	})

	t.Run("malformed UUID in JSON", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		consumer := NewConsumer(redisClient, chatService)

		malformedJSON := `{
			"id": "not-a-uuid",
			"chat_id": "` + uuid.New().String() + `",
			"sender_id": "` + uuid.New().String() + `",
			"content": "Test message",
			"message_type": 1,
			"created_at": "` + time.Now().Format(time.RFC3339) + `",
			"updated_at": "` + time.Now().Format(time.RFC3339) + `",
			"is_edited": false,
			"is_read": false
		}`

		redisMsg := &redis.Message{
			Channel: "new_messages",
			Payload: malformedJSON,
		}

		consumer.processMessage(redisMsg)

		chatService.AssertNotCalled(t, "ProcessNewMessage", mock.Anything, mock.Anything)
	})
}

func TestConsumer_Concurrent(t *testing.T) {
	t.Run("handle concurrent messages", func(t *testing.T) {
		redisClient := &MockRedisClient{}
		chatService := &MockChatService{}

		messagesChan := make(chan *redis.Message, 100)
		
		redisClient.On("Subscribe", mock.Anything, []string{"new_messages"}).
			Return((<-chan *redis.Message)(messagesChan))

		consumer := NewConsumer(redisClient, chatService)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		go consumer.Start(ctx)
		time.Sleep(50 * time.Millisecond)

		for i := 0; i < 5; i++ {
			go func(index int) {
				messageID := uuid.New()
				chatID := uuid.New()
				senderID := uuid.New()

				testMessage := domain.Message{
					ID:          messageID,
					ChatID:      chatID,
					SenderID:    senderID,
					Content:     "Concurrent message",
					MessageType: domain.MessageTypeText,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
					IsEdited:    false,
					IsRead:      false,
				}

				messageJSON, err := json.Marshal(testMessage)
				require.NoError(t, err)

				chatService.On("ProcessNewMessage", mock.AnythingOfType("*context.timerCtx"), mock.MatchedBy(func(msg *domain.Message) bool {
					return msg.ID == messageID
				})).Return(nil).Once()

				messagesChan <- &redis.Message{
					Channel: "new_messages",
					Payload: string(messageJSON),
				}
			}(i)
		}

		time.Sleep(200 * time.Millisecond)
		assert.GreaterOrEqual(t, len(chatService.Calls), 5)
	})
}

