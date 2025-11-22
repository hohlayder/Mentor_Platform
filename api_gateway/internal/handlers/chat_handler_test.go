package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockChatService реализует ChatService для тестов
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
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ChatWithLastMessage), args.Error(1)
}

func (m *MockChatService) GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error) {
	args := m.Called(ctx, chatId, limit, cursor)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.GetChatMessagesResponse), args.Error(1)
}

func (m *MockChatService) MarkMessagesRead(ctx context.Context, chatId, userId string, messagesIDs []string) error {
	args := m.Called(ctx, chatId, userId, messagesIDs)
	return args.Error(0)
}

func (m *MockChatService) CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error) {
	args := m.Called(ctx, chatID, userID)
	return args.Bool(0), args.Error(1)
}

func TestChatHandler_CreateChat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		contextUserID  string
		requestBody    interface{}
		mockChatID     string
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockChatService, userID string, requestBody interface{})
	}{
		{
			name:          "success",
			contextUserID: "user123",
			requestBody: domain.CreateChatRequest{
				OtherUserID: "user456",
			},
			mockChatID:     "chat123",
			mockError:      nil,
			expectedStatus: http.StatusCreated,
			setupMock: func(mockService *MockChatService, userID string, requestBody interface{}) {
				req := requestBody.(domain.CreateChatRequest)
				mockService.On("CreateChat", mock.Anything, userID, req.OtherUserID).Return("chat123", nil)
			},
		},
		{
			name:          "unauthorized - no user_id in context",
			contextUserID: "",
			requestBody: domain.CreateChatRequest{
				OtherUserID: "user456",
			},
			mockChatID:     "",
			mockError:      nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:      func(mockService *MockChatService, userID string, requestBody interface{}) {},
		},
		{
			name:           "invalid request body",
			contextUserID:  "user123",
			requestBody:    "invalid json",
			mockChatID:     "",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockChatService, userID string, requestBody interface{}) {},
		},
		{
			name:          "service error",
			contextUserID: "user123",
			requestBody: domain.CreateChatRequest{
				OtherUserID: "user456",
			},
			mockChatID:     "",
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockChatService, userID string, requestBody interface{}) {
				req := requestBody.(domain.CreateChatRequest)
				mockService.On("CreateChat", mock.Anything, userID, req.OtherUserID).Return("", errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockChatService)
			handler := NewChatHandler(mockService)

			tt.setupMock(mockService, tt.contextUserID, tt.requestBody)

			var requestBody string
			switch body := tt.requestBody.(type) {
			case string:
				requestBody = body
			default:
				jsonBytes, err := json.Marshal(body)
				assert.NoError(t, err)
				requestBody = string(jsonBytes)
			}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", "/chats", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.CreateChat(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusCreated {
				var response domain.CreateChatResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockChatID, response.ChatID)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "VALIDATION_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestChatHandler_GetUserChats(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()
	user1ID := uuid.New()
	user2ID := uuid.New()
	messageID := uuid.New()
	chatID := uuid.New()

	tests := []struct {
		name           string
		contextUserID  string
		queryParams    string
		mockChats      []domain.ChatWithLastMessage
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockChatService, userID string, limit int32, offset int32)
	}{
		{
			name:          "success",
			contextUserID: user1ID.String(),
			queryParams:   "?limit=20&offset=0",
			mockChats: []domain.ChatWithLastMessage{
				{
					ID:        chatID,
					User1ID:   user1ID,
					User2ID:   user2ID,
					CreatedAt: createdAt,
					UpdatedAt: createdAt,
					IsActive:  true,
					LastMessageID:        &messageID,
					LastMessageChatID:    &chatID,
					LastMessageSenderID:  &user1ID,
					LastMessageContent:   stringPtr("Hello"),
					LastMessageType:      stringPtr("text"),
					LastMessageCreatedAt: &createdAt,
					LastMessageUpdatedAt: &createdAt,
					LastMessageIsEdited:  boolPtr(false),
					LastMessageIsRead:    boolPtr(true),
				},
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockChatService, userID string, limit int32, offset int32) {
				mockService.On("GetUserChats", mock.Anything, userID, limit, offset).Return([]domain.ChatWithLastMessage{
					{
						ID:        chatID,
						User1ID:   user1ID,
						User2ID:   user2ID,
						CreatedAt: createdAt,
						UpdatedAt: createdAt,
						IsActive:  true,
						LastMessageID:        &messageID,
						LastMessageChatID:    &chatID,
						LastMessageSenderID:  &user1ID,
						LastMessageContent:   stringPtr("Hello"),
						LastMessageType:      stringPtr("text"),
						LastMessageCreatedAt: &createdAt,
						LastMessageUpdatedAt: &createdAt,
						LastMessageIsEdited:  boolPtr(false),
						LastMessageIsRead:    boolPtr(true),
					},
				}, nil)
			},
		},
		{
			name:          "unauthorized - no user_id in context",
			contextUserID: "",
			queryParams:   "?limit=20&offset=0",
			mockChats:     nil,
			mockError:     nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:     func(mockService *MockChatService, userID string, limit int32, offset int32) {},
		},
		{
			name:          "service error",
			contextUserID: user1ID.String(),
			queryParams:   "?limit=20&offset=0",
			mockChats:     nil,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockChatService, userID string, limit int32, offset int32) {
				mockService.On("GetUserChats", mock.Anything, userID, limit, offset).Return([]domain.ChatWithLastMessage{}, errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockChatService)
			handler := NewChatHandler(mockService)

			var expectedLimit int32 = 20
			var expectedOffset int32 = 0
			if tt.queryParams != "" {
				if strings.Contains(tt.queryParams, "limit=10") {
					expectedLimit = 10
				}
				if strings.Contains(tt.queryParams, "offset=10") {
					expectedOffset = 10
				}
			}

			tt.setupMock(mockService, tt.contextUserID, expectedLimit, expectedOffset)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/chats"+tt.queryParams, nil)
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.GetUserChats(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.GetUserChatsResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Len(t, response.Chats, len(tt.mockChats))
				if len(tt.mockChats) > 0 {
					assert.Equal(t, tt.mockChats[0].ID.String(), response.Chats[0].ID)
					assert.Equal(t, tt.mockChats[0].User1ID.String(), response.Chats[0].User1ID)
					assert.Equal(t, tt.mockChats[0].User2ID.String(), response.Chats[0].User2ID)
				}
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestChatHandler_GetChatById(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()
	chatID := uuid.New()
	user1ID := uuid.New()
	user2ID := uuid.New()
	messageID := uuid.New()

	tests := []struct {
		name           string
		chatID         string
		contextUserID  string
		mockChat       *domain.ChatWithLastMessage
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockChatService, chatID string)
	}{
		{
			name:          "success - user is member (user1)",
			chatID:        chatID.String(),
			contextUserID: user1ID.String(),
			mockChat: &domain.ChatWithLastMessage{
				ID:        chatID,
				User1ID:   user1ID,
				User2ID:   user2ID,
				CreatedAt: createdAt,
				UpdatedAt: createdAt,
				IsActive:  true,
				LastMessageID:        &messageID,
				LastMessageChatID:    &chatID,
				LastMessageSenderID:  &user1ID,
				LastMessageContent:   stringPtr("Hello"),
				LastMessageType:      stringPtr("text"),
				LastMessageCreatedAt: &createdAt,
				LastMessageUpdatedAt: &createdAt,
				LastMessageIsEdited:  boolPtr(false),
				LastMessageIsRead:    boolPtr(true),
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockChatService, chatID string) {
				chatUUID := uuid.MustParse(chatID)
				mockService.On("GetChatById", mock.Anything, chatID).Return(&domain.ChatWithLastMessage{
					ID:        chatUUID,
					User1ID:   user1ID,
					User2ID:   user2ID,
					CreatedAt: createdAt,
					UpdatedAt: createdAt,
					IsActive:  true,
					LastMessageID:        &messageID,
					LastMessageChatID:    &chatUUID,
					LastMessageSenderID:  &user1ID,
					LastMessageContent:   stringPtr("Hello"),
					LastMessageType:      stringPtr("text"),
					LastMessageCreatedAt: &createdAt,
					LastMessageUpdatedAt: &createdAt,
					LastMessageIsEdited:  boolPtr(false),
					LastMessageIsRead:    boolPtr(true),
				}, nil)
			},
		},
		{
			name:          "success - user is member (user2)",
			chatID:        chatID.String(),
			contextUserID: user2ID.String(),
			mockChat: &domain.ChatWithLastMessage{
				ID:        chatID,
				User1ID:   user1ID,
				User2ID:   user2ID,
				CreatedAt: createdAt,
				UpdatedAt: createdAt,
				IsActive:  true,
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockChatService, chatID string) {
				chatUUID := uuid.MustParse(chatID)
				mockService.On("GetChatById", mock.Anything, chatID).Return(&domain.ChatWithLastMessage{
					
					ID:        chatUUID,
					User1ID:   user1ID,
					User2ID:   user2ID,
					CreatedAt: createdAt,
					UpdatedAt: createdAt,
					IsActive:  true,
				}, nil)
			},
		},
		{
			name:          "forbidden - user not member",
			chatID:        chatID.String(),
			contextUserID: uuid.New().String(), 
			mockChat: &domain.ChatWithLastMessage{
				ID:        chatID,
				User1ID:   user1ID,
				User2ID:   user2ID,
				CreatedAt: createdAt,
				UpdatedAt: createdAt,
				IsActive:  true,
			},
			mockError:      nil,
			expectedStatus: http.StatusForbidden,
			setupMock: func(mockService *MockChatService, chatID string) {
				chatUUID := uuid.MustParse(chatID)
				mockService.On("GetChatById", mock.Anything, chatID).Return(&domain.ChatWithLastMessage{
					ID:        chatUUID,
					User1ID:   user1ID,
					User2ID:   user2ID,
					CreatedAt: createdAt,
					UpdatedAt: createdAt,
					IsActive:  true,
				}, nil)
			},
		},
		{
			name:          "unauthorized - no user_id in context",
			chatID:        chatID.String(),
			contextUserID: "",
			mockChat:      nil,
			mockError:     nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:     func(mockService *MockChatService, chatID string) {},
		},
		{
			name:          "service error",
			chatID:        chatID.String(),
			contextUserID: user1ID.String(),
			mockChat:      nil,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockChatService, chatID string) {
				mockService.On("GetChatById", mock.Anything, chatID).Return((*domain.ChatWithLastMessage)(nil), errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockChatService)
			handler := NewChatHandler(mockService)

			tt.setupMock(mockService, tt.chatID)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/chats/"+tt.chatID, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.chatID}}
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.GetChatById(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.GetChatByIdResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.chatID, response.Chat.ID)
				assert.Equal(t, tt.mockChat.User1ID.String(), response.Chat.User1ID)
				assert.Equal(t, tt.mockChat.User2ID.String(), response.Chat.User2ID)
			} else if tt.expectedStatus == http.StatusForbidden {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "FORBIDDEN_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestChatHandler_GetChatMessages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()
	chatID := uuid.New().String()
	userID := uuid.New().String()
	messageID := uuid.New()

	tests := []struct {
		name           string
		queryParams    string
		contextUserID  string
		mockAccess     bool
		mockAccessErr  error
		mockMessages   *domain.GetChatMessagesResponse
		mockMessagesErr error
		expectedStatus int
		setupMock      func(mockService *MockChatService, chatID string, userID string, limit int32, cursor *domain.Cursor)
	}{
		{
			name:          "success",
			queryParams:   "?chat_id=" + chatID + "&limit=50",
			contextUserID: userID,
			mockAccess:    true,
			mockAccessErr: nil,
			mockMessages: &domain.GetChatMessagesResponse{
				Messages: []domain.Message{
					{
						ID:          messageID,
						ChatID:      uuid.MustParse(chatID),
						SenderID:    uuid.MustParse(userID),
						Content:     "Hello",
						MessageType: domain.MessageTypeText,
						CreatedAt:   createdAt,
						UpdatedAt:   createdAt,
						IsEdited:    false,
						IsRead:      true,
					},
				},
				NextCursor: nil,
				HasMore:    false,
			},
			mockMessagesErr: nil,
			expectedStatus:  http.StatusOK,
			setupMock: func(mockService *MockChatService, chatID string, userID string, limit int32, cursor *domain.Cursor) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(true, nil)
				mockService.On("GetChatMessages", mock.Anything, chatID, limit, cursor).Return(&domain.GetChatMessagesResponse{
					Messages: []domain.Message{
						{
							ID:          messageID,
							ChatID:      uuid.MustParse(chatID),
							SenderID:    uuid.MustParse(userID),
							Content:     "Hello",
							MessageType: domain.MessageTypeText,
							CreatedAt:   createdAt,
							UpdatedAt:   createdAt,
							IsEdited:    false,
							IsRead:      true,
						},
					},
					NextCursor: nil,
					HasMore:    false,
				}, nil)
			},
		},
		{
			name:          "forbidden - no access to chat",
			queryParams:   "?chat_id=" + chatID + "&limit=50",
			contextUserID: userID,
			mockAccess:    false,
			mockAccessErr: nil,
			mockMessages:  nil,
			mockMessagesErr: nil,
			expectedStatus: http.StatusForbidden,
			setupMock: func(mockService *MockChatService, chatID string, userID string, limit int32, cursor *domain.Cursor) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(false, nil)
			},
		},
		{
			name:          "unauthorized - no user_id in context",
			queryParams:   "?chat_id=" + chatID + "&limit=50",
			contextUserID: "",
			mockAccess:    false,
			mockAccessErr: nil,
			mockMessages:  nil,
			mockMessagesErr: nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:     func(mockService *MockChatService, chatID string, userID string, limit int32, cursor *domain.Cursor) {},
		},
		{
			name:          "access check error",
			queryParams:   "?chat_id=" + chatID + "&limit=50",
			contextUserID: userID,
			mockAccess:    false,
			mockAccessErr: errors.New("access check error"),
			mockMessages:  nil,
			mockMessagesErr: nil,
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockChatService, chatID string, userID string, limit int32, cursor *domain.Cursor) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(false, errors.New("access check error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockChatService)
			handler := NewChatHandler(mockService)

			var expectedLimit int32 = 50
			var expectedCursor *domain.Cursor = nil

			tt.setupMock(mockService, chatID, tt.contextUserID, expectedLimit, expectedCursor)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/chats/messages"+tt.queryParams, nil)
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.GetChatMessages(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.GetChatMessagesResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Len(t, response.Messages, 1)
				assert.Equal(t, messageID, response.Messages[0].ID)
			} else if tt.expectedStatus == http.StatusForbidden {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "FORBIDDEN_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestChatHandler_MarkMessagesRead(t *testing.T) {
	gin.SetMode(gin.TestMode)

	chatID := uuid.New().String()
	userID := uuid.New().String()
	messageIDs := []string{uuid.New().String(), uuid.New().String()}

	tests := []struct {
		name           string
		contextUserID  string
		requestBody    interface{}
		mockAccess     bool
		mockAccessErr  error
		mockMarkErr    error
		expectedStatus int
		setupMock      func(mockService *MockChatService, chatID string, userID string, messageIDs []string)
	}{
		{
			name:          "success",
			contextUserID: userID,
			requestBody: domain.MarkMessagesReadRequest{
				ChatId:     chatID,
				MessageIDs: messageIDs,
			},
			mockAccess:     true,
			mockAccessErr:  nil,
			mockMarkErr:    nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockChatService, chatID string, userID string, messageIDs []string) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(true, nil)
				mockService.On("MarkMessagesRead", mock.Anything, chatID, userID, messageIDs).Return(nil)
			},
		},
		{
			name:          "forbidden - no access to chat",
			contextUserID: userID,
			requestBody: domain.MarkMessagesReadRequest{
				ChatId:     chatID,
				MessageIDs: messageIDs,
			},
			mockAccess:     false,
			mockAccessErr:  nil,
			mockMarkErr:    nil,
			expectedStatus: http.StatusForbidden,
			setupMock: func(mockService *MockChatService, chatID string, userID string, messageIDs []string) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(false, nil)
			},
		},
		{
			name:          "unauthorized - no user_id in context",
			contextUserID: "",
			requestBody: domain.MarkMessagesReadRequest{
				ChatId:     chatID,
				MessageIDs: messageIDs,
			},
			mockAccess:     false,
			mockAccessErr:  nil,
			mockMarkErr:    nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:     func(mockService *MockChatService, chatID string, userID string, messageIDs []string) {},
		},
		{
			name:           "invalid request body",
			contextUserID:  userID,
			requestBody:    "invalid json",
			mockAccess:     false,
			mockAccessErr:  nil,
			mockMarkErr:    nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:     func(mockService *MockChatService, chatID string, userID string, messageIDs []string) {},
		},
		{
			name:          "mark messages error",
			contextUserID: userID,
			requestBody: domain.MarkMessagesReadRequest{
				ChatId:     chatID,
				MessageIDs: messageIDs,
			},
			mockAccess:     true,
			mockAccessErr:  nil,
			mockMarkErr:    errors.New("mark error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockChatService, chatID string, userID string, messageIDs []string) {
				mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).Return(true, nil)
				mockService.On("MarkMessagesRead", mock.Anything, chatID, userID, messageIDs).Return(errors.New("mark error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockChatService)
			handler := NewChatHandler(mockService)

			var requestBody string
			switch body := tt.requestBody.(type) {
			case string:
				requestBody = body
			default:
				jsonBytes, err := json.Marshal(body)
				assert.NoError(t, err)
				requestBody = string(jsonBytes)
			}

			if tt.contextUserID != "" {
				if req, ok := tt.requestBody.(domain.MarkMessagesReadRequest); ok {
					tt.setupMock(mockService, req.ChatId, tt.contextUserID, req.MessageIDs)
				}
			}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", "/chats/messages/read", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.MarkMessagesRead(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.MarkMessagesReadResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.True(t, response.Success)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "VALIDATION_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusForbidden {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "FORBIDDEN_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}