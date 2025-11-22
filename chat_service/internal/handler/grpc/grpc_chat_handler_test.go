// handler_test.go
package grpc

import (
	"context"
	"errors"
	"testing"
	"time"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

func (m *MockChatService) MarkMessagesRead(ctx context.Context, chatId string, messagesIDs []string) error {
	args := m.Called(ctx, chatId, messagesIDs)
	return args.Error(0)
}

func (m *MockChatService) CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error) {
	args := m.Called(ctx, chatID, userID)
	return args.Bool(0), args.Error(1)
}

func TestChatHandler(t *testing.T) {

	t.Run("CreateChat", func(t *testing.T) {
		t.Run("success", testCreateChat_Success)
		t.Run("service error", testCreateChat_ServiceError)
	})

	t.Run("GetUserChats", func(t *testing.T) {
		t.Run("success", testGetUserChats_Success)
		t.Run("service error", testGetUserChats_ServiceError)
	})

	t.Run("GetChatById", func(t *testing.T) {
		t.Run("success", testGetChatById_Success)
		t.Run("not found", testGetChatById_NotFound)
		t.Run("service error", testGetChatById_ServiceError)
	})

	t.Run("GetChatMessages", func(t *testing.T) {
		t.Run("success without cursor", testGetChatMessages_SuccessWithoutCursor)
		t.Run("service error", testGetChatMessages_ServiceError)
	})

	t.Run("MarkMessagesRead", func(t *testing.T) {
		t.Run("success", testMarkMessagesRead_Success)
		t.Run("service error", testMarkMessagesRead_ServiceError)
	})

	t.Run("CheckUserAccessToChat", func(t *testing.T) {
		t.Run("has access", testCheckUserAccessToChat_HasAccess)
		t.Run("no access", testCheckUserAccessToChat_NoAccess)
		t.Run("invalid arguments", testCheckUserAccessToChat_InvalidArguments)
		t.Run("service error", testCheckUserAccessToChat_ServiceError)
	})
}

// Вспомогательные функции
func createTestChatWithLastMessage() domain.ChatWithLastMessage {
	chatID := uuid.New()
	user1ID := uuid.New()
	user2ID := uuid.New()
	messageID := uuid.New()
	content := "Hello, world!"
	messageType := "text"
	createdAt := time.Now()
	isEdited := false
	isRead := true
	readAt := time.Now()

	return domain.ChatWithLastMessage{
		ID:        chatID,
		User1ID:   user1ID,
		User2ID:   user2ID,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
		IsActive:  true,

		// Last message fields
		LastMessageID:        &messageID,
		LastMessageChatID:    &chatID,
		LastMessageSenderID:  &user1ID,
		LastMessageContent:   &content,
		LastMessageType:      &messageType,
		LastMessageCreatedAt: &createdAt,
		LastMessageUpdatedAt: &createdAt,
		LastMessageIsEdited:  &isEdited,
		LastMessageIsRead:    &isRead,
		LastMessageReadAt:    &readAt,
	}
}

func createTestMessage() domain.Message {
	msgID := uuid.New()
	chatID := uuid.New()
	senderID := uuid.New()
	content := "Test message"
	createdAt := time.Now()

	return domain.Message{
		ID:          msgID,
		ChatID:      chatID,
		SenderID:    senderID,
		Content:     content,
		MessageType: domain.MessageTypeText,
		CreatedAt:   createdAt,
		UpdatedAt:   createdAt,
		IsEdited:    false,
		IsRead:      false,
		Attachments: []domain.Attachment{},
	}
}

func createTestGetChatMessagesResponse() *domain.GetChatMessagesResponse {
	messages := []domain.Message{createTestMessage()}

	return &domain.GetChatMessagesResponse{
		Messages: messages,
		HasMore:  false,
	}
}

// Тесты для CreateChat
func testCreateChat_Success(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	userID := uuid.New().String()
	otherUserID := uuid.New().String()
	chatID := uuid.New().String()

	req := &chatv1.CreateChatRequest{
		UserId:      userID,
		OtherUserId: otherUserID,
	}

	mockService.On("CreateChat", mock.Anything, userID, otherUserID).
		Return(chatID, nil).
		Once()

	resp, err := handler.CreateChat(context.Background(), req)

	require.NoError(t, err)
	assert.Equal(t, chatID, resp.ChatId)
	mockService.AssertExpectations(t)
}

func testCreateChat_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	userID := uuid.New().String()
	otherUserID := uuid.New().String()

	req := &chatv1.CreateChatRequest{
		UserId:      userID,
		OtherUserId: otherUserID,
	}

	mockService.On("CreateChat", mock.Anything, userID, otherUserID).
		Return("", errors.New("service error")).
		Once()

	resp, err := handler.CreateChat(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

// Тесты для GetUserChats
func testGetUserChats_Success(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	userID := uuid.New().String()
	limit := int32(10)
	offset := int32(0)

	req := &chatv1.GetUserChatsRequest{
		UserId: userID,
		Limit:  limit,
		Offset: offset,
	}

	testChat := createTestChatWithLastMessage()
	chats := []domain.ChatWithLastMessage{testChat}

	mockService.On("GetUserChats", mock.Anything, userID, limit, offset).
		Return(chats, nil).
		Once()

	resp, err := handler.GetUserChats(context.Background(), req)

	require.NoError(t, err)
	require.Len(t, resp.Chats, 1)

	chatProto := resp.Chats[0]
	assert.Equal(t, testChat.ID.String(), chatProto.Id)
	assert.Equal(t, testChat.User1ID.String(), chatProto.User1Id)
	assert.Equal(t, testChat.User2ID.String(), chatProto.User2Id)

	assert.Equal(t, testChat.LastMessageID.String(), chatProto.LastMessage.Id)
	assert.Equal(t, *testChat.LastMessageContent, chatProto.LastMessage.Content)

	mockService.AssertExpectations(t)
}

func testGetUserChats_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	userID := uuid.New().String()

	req := &chatv1.GetUserChatsRequest{
		UserId: userID,
		Limit:  10,
		Offset: 0,
	}

	mockService.On("GetUserChats", mock.Anything, userID, int32(10), int32(0)).
		Return([]domain.ChatWithLastMessage{}, errors.New("service error")).
		Once()

	resp, err := handler.GetUserChats(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

// Тесты для GetChatById
func testGetChatById_Success(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()

	req := &chatv1.GetChatByIdRequest{
		Id: chatID,
	}

	testChat := createTestChatWithLastMessage()

	mockService.On("GetChatById", mock.Anything, chatID).
		Return(&testChat, nil).
		Once()

	resp, err := handler.GetChatById(context.Background(), req)

	require.NoError(t, err)
	require.NotNil(t, resp.Chat)

	chatProto := resp.Chat
	assert.Equal(t, testChat.ID.String(), chatProto.Id)
	assert.Equal(t, testChat.User1ID.String(), chatProto.User1Id)
	assert.Equal(t, testChat.User2ID.String(), chatProto.User2Id)

	mockService.AssertExpectations(t)
}

func testGetChatById_NotFound(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()

	req := &chatv1.GetChatByIdRequest{
		Id: chatID,
	}

	mockService.On("GetChatById", mock.Anything, chatID).
		Return((*domain.ChatWithLastMessage)(nil), domain.ErrChatNotFound).
		Once()

	resp, err := handler.GetChatById(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

func testGetChatById_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()

	req := &chatv1.GetChatByIdRequest{
		Id: chatID,
	}

	mockService.On("GetChatById", mock.Anything, chatID).
		Return((*domain.ChatWithLastMessage)(nil), errors.New("service error")).
		Once()

	resp, err := handler.GetChatById(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

// Тесты для GetChatMessages
func testGetChatMessages_SuccessWithoutCursor(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	limit := int32(50)

	req := &chatv1.GetChatMessagesRequest{
		ChatId: chatID,
		Limit:  limit,
		Cursor: nil,
	}

	serviceResp := createTestGetChatMessagesResponse()

	mockService.On("GetChatMessages", mock.Anything, chatID, limit, (*domain.Cursor)(nil)).
		Return(serviceResp, nil).
		Once()

	resp, err := handler.GetChatMessages(context.Background(), req)

	require.NoError(t, err)
	require.Len(t, resp.Messages, 1)
	assert.False(t, resp.HasMore)
	assert.Nil(t, resp.NextCursor)

	msgProto := resp.Messages[0]
	testMsg := serviceResp.Messages[0]
	assert.Equal(t, testMsg.ID.String(), msgProto.Id)
	assert.Equal(t, testMsg.Content, msgProto.Content)

	mockService.AssertExpectations(t)
}

func testGetChatMessages_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()

	req := &chatv1.GetChatMessagesRequest{
		ChatId: chatID,
		Limit:  50,
		Cursor: nil,
	}

	mockService.On("GetChatMessages", mock.Anything, chatID, int32(50), (*domain.Cursor)(nil)).
		Return((*domain.GetChatMessagesResponse)(nil), errors.New("service error")).
		Once()

	resp, err := handler.GetChatMessages(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

// Тесты для MarkMessagesRead
func testMarkMessagesRead_Success(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	messageIDs := []string{uuid.New().String(), uuid.New().String()}

	req := &chatv1.MarkMessagesReadRequest{
		ChatId:     chatID,
		MessageIds: messageIDs,
	}

	mockService.On("MarkMessagesRead", mock.Anything, chatID, messageIDs).
		Return(nil).
		Once()

	resp, err := handler.MarkMessagesRead(context.Background(), req)

	require.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func testMarkMessagesRead_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	messageIDs := []string{uuid.New().String()}

	req := &chatv1.MarkMessagesReadRequest{
		ChatId:     chatID,
		MessageIds: messageIDs,
	}

	mockService.On("MarkMessagesRead", mock.Anything, chatID, messageIDs).
		Return(errors.New("service error")).
		Once()

	resp, err := handler.MarkMessagesRead(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}

// Тесты для CheckUserAccessToChat
func testCheckUserAccessToChat_HasAccess(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	userID := uuid.New().String()

	req := &chatv1.CheckUserAccessToChatRequest{
		ChatId: chatID,
		UserId: userID,
	}

	mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).
		Return(true, nil).
		Once()

	resp, err := handler.CheckUserAccessToChat(context.Background(), req)

	require.NoError(t, err)
	assert.True(t, resp.HasAccess)
	mockService.AssertExpectations(t)
}

func testCheckUserAccessToChat_NoAccess(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	userID := uuid.New().String()

	req := &chatv1.CheckUserAccessToChatRequest{
		ChatId: chatID,
		UserId: userID,
	}

	mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).
		Return(false, nil).
		Once()

	resp, err := handler.CheckUserAccessToChat(context.Background(), req)

	require.NoError(t, err)
	assert.False(t, resp.HasAccess)
	mockService.AssertExpectations(t)
}

func testCheckUserAccessToChat_InvalidArguments(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	userID := uuid.New().String()

	req := &chatv1.CheckUserAccessToChatRequest{
		ChatId: chatID,
		UserId: userID,
	}

	mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).
		Return(false, domain.ErrInvalidChatID).
		Once()

	resp, err := handler.CheckUserAccessToChat(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, st.Code())
	mockService.AssertExpectations(t)
}

func testCheckUserAccessToChat_ServiceError(t *testing.T) {
	mockService := new(MockChatService)
	handler := NewChatHandler(mockService)

	chatID := uuid.New().String()
	userID := uuid.New().String()

	req := &chatv1.CheckUserAccessToChatRequest{
		ChatId: chatID,
		UserId: userID,
	}

	mockService.On("CheckUserAccessToChat", mock.Anything, chatID, userID).
		Return(false, errors.New("service error")).
		Once()

	resp, err := handler.CheckUserAccessToChat(context.Background(), req)

	assert.Error(t, err)
	assert.Nil(t, resp)

	st, ok := status.FromError(err)
	assert.True(t, ok)
	assert.Equal(t, codes.Internal, st.Code())
	mockService.AssertExpectations(t)
}
