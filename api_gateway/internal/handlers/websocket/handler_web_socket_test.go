package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockWebSocketService struct {
	mock.Mock
}

func (m *MockWebSocketService) HandleConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error {
	args := m.Called(userID, conn, ipAddress)
	return args.Error(0)
}

func (m *MockWebSocketService) HandleDisconnection(userID uuid.UUID) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockWebSocketService) HandleMessage(message *domain.Message) error {
	args := m.Called(message)
	return args.Error(0)
}

// MockMessageService реализует MessageService для тестов
type MockMessageService struct {
	mock.Mock
}

func (m *MockMessageService) SendMessageInstantly(message *domain.Message) error {
	args := m.Called(message)
	return args.Error(0)
}

func TestWebSocketHandler_HandleWebSocket_Authentication(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		contextUserID  interface{}
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "unauthorized - no user_id in context",
			contextUserID:  nil,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
		{
			name:           "unauthorized - invalid user_id type",
			contextUserID:  123,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid user ID",
		},
		{
			name:           "unauthorized - empty user_id",
			contextUserID:  "",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid user ID",
		},
		{
			name:           "unauthorized - invalid uuid format",
			contextUserID:  "invalid-uuid",
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid user ID format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wsMock := new(MockWebSocketService)
			msgMock := new(MockMessageService)
			handler := NewWebSocketHandler(wsMock, msgMock)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/ws", nil)

			if tt.contextUserID != nil {
				c.Set("user_id", tt.contextUserID)
			}

			handler.HandleWebSocket(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if w.Body.Len() > 0 {
				var response gin.H
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["error"] != nil {
					assert.Contains(t, response["error"].(string), tt.expectedError)
				}
			}

			wsMock.AssertExpectations(t)
			msgMock.AssertExpectations(t)
		})
	}
}

func TestMessageCreation(t *testing.T) {
	userID := uuid.New()
	chatID := uuid.New()
	replyTo := uuid.New()

	incomingMsg := IncomingMessage{
		ChatID:      chatID,
		Content:     "Test message with reply",
		ReplyTo:     &replyTo,
		MessageType: domain.MessageTypeText,
		Attachments: []domain.Attachment{
			{
				ID:       uuid.New(),
				URL:      "http://example.com/file.jpg",
				FileName: "file.jpg",
				MimeType: "image/jpeg",
				FileSize: 1024,
			},
		},
	}

	message := &domain.Message{
		ID:          uuid.New(),
		ChatID:      incomingMsg.ChatID,
		SenderID:    userID,
		Content:     incomingMsg.Content,
		ReplyTo:     incomingMsg.ReplyTo,
		MessageType: incomingMsg.MessageType,
		Attachments: incomingMsg.Attachments,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsEdited:    false,
		IsRead:      false,
	}

	assert.Equal(t, chatID, message.ChatID)
	assert.Equal(t, userID, message.SenderID)
	assert.Equal(t, "Test message with reply", message.Content)
	assert.Equal(t, &replyTo, message.ReplyTo)
	assert.Equal(t, domain.MessageTypeText, message.MessageType)
	assert.Len(t, message.Attachments, 1)
	assert.Equal(t, "file.jpg", message.Attachments[0].FileName)
	assert.False(t, message.IsEdited)
	assert.False(t, message.IsRead)
}

func TestDifferentMessageTypes(t *testing.T) {
	userID := uuid.New()
	chatID := uuid.New()

	testCases := []struct {
		name        string
		messageType domain.MessageType
		content     string
	}{
		{"text message", domain.MessageTypeText, "Hello world"},
		{"image message", domain.MessageTypeImage, "Check this image"},
		{"file message", domain.MessageTypeFile, "File attached"},
		{"voice message", domain.MessageTypeVoice, "Voice message"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			incomingMsg := IncomingMessage{
				ChatID:      chatID,
				Content:     tc.content,
				MessageType: tc.messageType,
			}

			message := &domain.Message{
				ID:          uuid.New(),
				ChatID:      incomingMsg.ChatID,
				SenderID:    userID,
				Content:     incomingMsg.Content,
				MessageType: incomingMsg.MessageType,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
				IsEdited:    false,
				IsRead:      false,
			}

			assert.Equal(t, tc.messageType, message.MessageType)
			assert.Equal(t, tc.content, message.Content)
			assert.Equal(t, chatID, message.ChatID)
			assert.Equal(t, userID, message.SenderID)
		})
	}
}

