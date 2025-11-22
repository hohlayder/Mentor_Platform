package service

import (
	"context"
	"errors"
	"testing"
	"time"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type MockChatClient struct {
	mock.Mock
}

func (m *MockChatClient) CreateChat(ctx context.Context, in *chatv1.CreateChatRequest) (*chatv1.CreateChatResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.CreateChatResponse), args.Error(1)
}

func (m *MockChatClient) GetUserChats(ctx context.Context, in *chatv1.GetUserChatsRequest) (*chatv1.GetUserChatsResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.GetUserChatsResponse), args.Error(1)
}

func (m *MockChatClient) GetChatById(ctx context.Context, in *chatv1.GetChatByIdRequest) (*chatv1.GetChatByIdResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.GetChatByIdResponse), args.Error(1)
}

func (m *MockChatClient) GetChatMessages(ctx context.Context, in *chatv1.GetChatMessagesRequest) (*chatv1.GetChatMessagesResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.GetChatMessagesResponse), args.Error(1)
}

func (m *MockChatClient) MarkMessagesRead(ctx context.Context, in *chatv1.MarkMessagesReadRequest) (*chatv1.MarkMessagesReadResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.MarkMessagesReadResponse), args.Error(1)
}

func (m *MockChatClient) CheckUserAccessToChat(ctx context.Context, in *chatv1.CheckUserAccessToChatRequest) (*chatv1.CheckUserAccessToChatResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatv1.CheckUserAccessToChatResponse), args.Error(1)
}

func TestChatService_CreateChat(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		userID         string
		otherUserID    string
		mockResponse   *chatv1.CreateChatResponse
		mockError      error
		expectedResult string
		expectedError  string
	}{
		{
			name:        "success",
			userID:      "user-123",
			otherUserID: "user-456",
			mockResponse: &chatv1.CreateChatResponse{
				ChatId: "chat-789",
			},
			mockError:      nil,
			expectedResult: "chat-789",
			expectedError:  "",
		},
		{
			name:           "client error",
			userID:         "user-123",
			otherUserID:    "user-456",
			mockResponse:   nil,
			mockError:      errors.New("create chat error"),
			expectedResult: "",
			expectedError:  "create chat error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			mockClient.On("CreateChat", ctx, &chatv1.CreateChatRequest{
				UserId:      tt.userID,
				OtherUserId: tt.otherUserID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := chatService.CreateChat(ctx, tt.userID, tt.otherUserID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestChatService_GetUserChats(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Now().UTC()
	updatedAt := time.Now().UTC()
	chatID := "chat-123"
	user1ID := "user-123"
	user2ID := "user-456"
	messageID := "msg-789"
	content := "Hello, world!"
	messageType := "text"

	tests := []struct {
		name           string
		userID         string
		limit          int32
		offset         int32
		mockResponse   *chatv1.GetUserChatsResponse
		mockError      error
		expectedResult []domain.ChatWithLastMessage
		expectedError  string
	}{
		{
			name:   "success with chats",
			userID: "user-123",
			limit:  10,
			offset: 0,
			mockResponse: &chatv1.GetUserChatsResponse{
				Chats: []*chatv1.Chat{
					{
						Id:        chatID,
						User1Id:   user1ID,
						User2Id:   user2ID,
						CreatedAt: timestamppb.New(createdAt),
						UpdatedAt: timestamppb.New(updatedAt),
						LastMessage: &chatv1.Message{
							Id:          messageID,
							ChatId:      chatID,
							SenderId:    user1ID,
							Content:     content,
							MessageType: messageType,
							CreatedAt:   timestamppb.New(createdAt),
							UpdatedAt:   timestamppb.New(updatedAt),
							IsEdited:    false,
							IsRead:      true,
							ReadAt:      timestamppb.New(updatedAt),
						},
					},
				},
			},
			mockError: nil,
			expectedResult: []domain.ChatWithLastMessage{
				{
					ID:                   utils.StringToUUID(chatID),
					User1ID:              utils.StringToUUID(user1ID),
					User2ID:              utils.StringToUUID(user2ID),
					CreatedAt:            createdAt,
					UpdatedAt:            updatedAt,
					IsActive:             true,
					LastMessageID:        utils.UUIDPtr(utils.StringToUUID(messageID)),
					LastMessageChatID:    utils.UUIDPtr(utils.StringToUUID(chatID)),
					LastMessageSenderID:  utils.UUIDPtr(utils.StringToUUID(user1ID)),
					LastMessageContent:   &content,
					LastMessageType:      &messageType,
					LastMessageCreatedAt: utils.TimePtr(createdAt),
					LastMessageUpdatedAt: utils.TimePtr(updatedAt),
					LastMessageIsEdited:  utils.BoolPtr(false),
					LastMessageIsRead:    utils.BoolPtr(true),
					LastMessageReadAt:    utils.TimePtr(updatedAt),
				},
			},
			expectedError: "",
		},
		{
			name:   "success with empty chats",
			userID: "user-123",
			limit:  10,
			offset: 0,
			mockResponse: &chatv1.GetUserChatsResponse{
				Chats: []*chatv1.Chat{},
			},
			mockError:      nil,
			expectedResult: nil, 
			expectedError:  "",
		},
		{
			name:           "client error",
			userID:         "user-123",
			limit:          10,
			offset:         0,
			mockResponse:   nil,
			mockError:      errors.New("get user chats error"),
			expectedResult: nil,
			expectedError:  "get user chats error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			mockClient.On("GetUserChats", ctx, &chatv1.GetUserChatsRequest{
				UserId: tt.userID,
				Limit:  tt.limit,
				Offset: tt.offset,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := chatService.GetUserChats(ctx, tt.userID, tt.limit, tt.offset)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				// Для пустых чатов проверяем, что результат либо nil, либо пустой slice
				if tt.expectedResult == nil {
					assert.True(t, result == nil, 
						"Expected nil or empty slice, got: %v", result)
				} else {
					assert.Equal(t, tt.expectedResult, result)
				}
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestChatService_GetChatById(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Now().UTC()
	updatedAt := time.Now().UTC()
	chatID := "chat-123"
	user1ID := "user-123"
	user2ID := "user-456"

	tests := []struct {
		name           string
		chatID         string
		mockResponse   *chatv1.GetChatByIdResponse
		mockError      error
		expectedResult *domain.ChatWithLastMessage
		expectedError  string
	}{
		{
			name:   "success",
			chatID: "chat-123",
			mockResponse: &chatv1.GetChatByIdResponse{
				Chat: &chatv1.Chat{
					Id:        chatID,
					User1Id:   user1ID,
					User2Id:   user2ID,
					CreatedAt: timestamppb.New(createdAt),
					UpdatedAt: timestamppb.New(updatedAt),
				},
			},
			mockError: nil,
			expectedResult: &domain.ChatWithLastMessage{
				ID:        utils.StringToUUID(chatID),
				User1ID:   utils.StringToUUID(user1ID),
				User2ID:   utils.StringToUUID(user2ID),
				CreatedAt: createdAt,
				UpdatedAt: updatedAt,
				IsActive:  true,
			},
			expectedError: "",
		},
		{
			name:           "chat not found",
			chatID:         "non-existent",
			mockResponse:   nil,
			mockError:      errors.New("chat not found"),
			expectedResult: nil,
			expectedError:  "chat not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			mockClient.On("GetChatById", ctx, &chatv1.GetChatByIdRequest{
				Id: tt.chatID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := chatService.GetChatById(ctx, tt.chatID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestChatService_GetChatMessages(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Now().UTC()
	updatedAt := time.Now().UTC()
	chatID := "chat-123"
	messageID := "msg-789"
	senderID := "user-123"
	content := "Test message"

	tests := []struct {
		name           string
		chatID         string
		limit          int32
		cursor         *domain.Cursor
		mockResponse   *chatv1.GetChatMessagesResponse
		mockError      error
		expectedResult *domain.GetChatMessagesResponse
		expectedError  string
	}{
		{
			name:   "success with messages",
			chatID: "chat-123",
			limit:  10,
			cursor: nil,
			mockResponse: &chatv1.GetChatMessagesResponse{
				Messages: []*chatv1.Message{
					{
						Id:          messageID,
						ChatId:      chatID,
						SenderId:    senderID,
						Content:     content,
						MessageType: "text",
						CreatedAt:   timestamppb.New(createdAt),
						UpdatedAt:   timestamppb.New(updatedAt),
						IsEdited:    false,
						IsRead:      true,
					},
				},
				HasMore: true,
				NextCursor: &chatv1.Cursor{
					Id:        "next-cursor",
					CreatedAt: timestamppb.New(createdAt),
				},
			},
			mockError: nil,
			expectedResult: &domain.GetChatMessagesResponse{
				Messages: []domain.Message{
					{
						ID:          utils.StringToUUID(messageID),
						ChatID:      utils.StringToUUID(chatID),
						SenderID:    utils.StringToUUID(senderID),
						Content:     content,
						MessageType: domain.MessageType("text"),
						CreatedAt:   createdAt,
						UpdatedAt:   updatedAt,
						IsEdited:    false,
						IsRead:      true,
					},
				},
				HasMore: true,
				NextCursor: &domain.Cursor{
					ID:        "next-cursor",
					CreatedAt: createdAt,
				},
			},
			expectedError: "",
		},
		{
			name:   "success with cursor",
			chatID: "chat-123",
			limit:  10,
			cursor: &domain.Cursor{
				ID:        "cursor-id",
				CreatedAt: createdAt,
			},
			mockResponse: &chatv1.GetChatMessagesResponse{
				Messages: []*chatv1.Message{},
				HasMore:  false,
			},
			mockError: nil,
			expectedResult: &domain.GetChatMessagesResponse{
				Messages: nil, 
				HasMore:  false,
			},
			expectedError: "",
		},
		{
			name:           "client error",
			chatID:         "chat-123",
			limit:          10,
			cursor:         nil,
			mockResponse:   nil,
			mockError:      errors.New("get messages error"),
			expectedResult: nil,
			expectedError:  "get messages error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			var protoCursor *chatv1.Cursor
			if tt.cursor != nil {
				protoCursor = &chatv1.Cursor{
					Id:        tt.cursor.ID,
					CreatedAt: timestamppb.New(tt.cursor.CreatedAt),
				}
			}

			mockClient.On("GetChatMessages", ctx, &chatv1.GetChatMessagesRequest{
				ChatId: tt.chatID,
				Limit:  tt.limit,
				Cursor: protoCursor,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := chatService.GetChatMessages(ctx, tt.chatID, tt.limit, tt.cursor)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestChatService_MarkMessagesRead(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name          string
		chatID        string
		userID        string
		messageIDs    []string
		mockResponse  *chatv1.MarkMessagesReadResponse
		mockError     error
		expectedError string
	}{
		{
			name:         "success",
			chatID:       "chat-123",
			userID:       "user-123",
			messageIDs:   []string{"msg-1", "msg-2"},
			mockResponse: &chatv1.MarkMessagesReadResponse{},
			mockError:    nil,
			expectedError: "",
		},
		{
			name:         "client error",
			chatID:       "chat-123",
			userID:       "user-123",
			messageIDs:   []string{"msg-1"},
			mockResponse: nil,
			mockError:    errors.New("mark read error"),
			expectedError: "mark read error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			mockClient.On("MarkMessagesRead", ctx, &chatv1.MarkMessagesReadRequest{
				ChatId:    tt.chatID,
				UserId:    tt.userID,
				MessageIds: tt.messageIDs,
			}).Return(tt.mockResponse, tt.mockError)

			err := chatService.MarkMessagesRead(ctx, tt.chatID, tt.userID, tt.messageIDs)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestChatService_CheckUserAccessToChat(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		chatID         string
		userID         string
		mockResponse   *chatv1.CheckUserAccessToChatResponse
		mockError      error
		expectedResult bool
		expectedError  string
	}{
		{
			name:   "has access",
			chatID: "chat-123",
			userID: "user-123",
			mockResponse: &chatv1.CheckUserAccessToChatResponse{
				HasAccess: true,
			},
			mockError:      nil,
			expectedResult: true,
			expectedError:  "",
		},
		{
			name:   "no access",
			chatID: "chat-123",
			userID: "user-456",
			mockResponse: &chatv1.CheckUserAccessToChatResponse{
				HasAccess: false,
			},
			mockError:      nil,
			expectedResult: false,
			expectedError:  "",
		},
		{
			name:           "client error",
			chatID:         "chat-123",
			userID:         "user-123",
			mockResponse:   nil,
			mockError:      errors.New("check access error"),
			expectedResult: false,
			expectedError:  "check access error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockChatClient)
			chatService := NewChatService(mockClient)

			mockClient.On("CheckUserAccessToChat", ctx, &chatv1.CheckUserAccessToChatRequest{
				ChatId: tt.chatID,
				UserId: tt.userID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := chatService.CheckUserAccessToChat(ctx, tt.chatID, tt.userID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}