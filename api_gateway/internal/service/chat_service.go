package service

import (
	"context"
	"fmt"
	"log/slog"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ChatClient interface {
    CreateChat(ctx context.Context, in *chatv1.CreateChatRequest) (*chatv1.CreateChatResponse, error)
    GetUserChats(ctx context.Context, in *chatv1.GetUserChatsRequest) (*chatv1.GetUserChatsResponse, error)
    GetChatById(ctx context.Context, in *chatv1.GetChatByIdRequest) (*chatv1.GetChatByIdResponse, error)
    GetChatMessages(ctx context.Context, in *chatv1.GetChatMessagesRequest) (*chatv1.GetChatMessagesResponse, error)
    MarkMessagesRead(ctx context.Context, in *chatv1.MarkMessagesReadRequest) (*chatv1.MarkMessagesReadResponse, error)
    CheckUserAccessToChat(ctx context.Context, in *chatv1.CheckUserAccessToChatRequest) (*chatv1.CheckUserAccessToChatResponse, error)
}

type ChatService struct {
	chatClient ChatClient
}

func NewChatService(chatClient ChatClient) *ChatService{
	return &ChatService{chatClient: chatClient}
}


func (s *ChatService) CreateChat(ctx context.Context, userId string, otherUserId string) (string, error) {
	req := &chatv1.CreateChatRequest{
		UserId:      userId,
		OtherUserId: otherUserId,
	}

	resp, err := s.chatClient.CreateChat(ctx, req)
	if err != nil {
		slog.Error("Failed to create chat via gRPC", "error", err)
		return "", err
	}

	return resp.ChatId, nil
}

func (s *ChatService) GetUserChats(ctx context.Context, userId string, limit int32, offset int32) ([]domain.ChatWithLastMessage, error) {
	req := &chatv1.GetUserChatsRequest{
		UserId: userId,
		Limit:  limit,
		Offset: offset,
	}

	resp, err := s.chatClient.GetUserChats(ctx, req)
	if err != nil {
		slog.Error("Failed to get user chats via gRPC", "error", err)
		return nil, err
	}

	return s.convertChatsFromProto(resp.Chats), nil
}

func (s *ChatService) GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error) {
	req := &chatv1.GetChatByIdRequest{
		Id: chatId,
	}

	resp, err := s.chatClient.GetChatById(ctx, req)
	if err != nil {
		slog.Error("Failed to get chat by id via gRPC", "error", err)
		return nil, err
	}

	return s.convertChatFromProto(resp.Chat), nil
}

func (s *ChatService) GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error) {
	var protoCursor *chatv1.Cursor
	if cursor != nil {
		protoCursor = &chatv1.Cursor{
			Id:        cursor.ID,
			CreatedAt: timestamppb.New(cursor.CreatedAt),
		}
	}

	req := &chatv1.GetChatMessagesRequest{
		ChatId: chatId,
		Limit:  limit,
		Cursor: protoCursor,
	}

	resp, err := s.chatClient.GetChatMessages(ctx, req)
	if err != nil {
		slog.Error("Failed to get chat messages via gRPC", "error", err)
		return nil, err
	}

	return s.convertMessagesResponseFromProto(resp), nil
}

func (s *ChatService) MarkMessagesRead(ctx context.Context, chatId, userId string, messagesIDs []string) error {
	req := chatv1.MarkMessagesReadRequest{
		UserId: userId,
		ChatId: chatId,
		MessageIds: messagesIDs,
	}
	_, err := s.chatClient.MarkMessagesRead(ctx, &req)
	if err != nil {
		return fmt.Errorf("failed to mark message read: %w", err)
	}

	return nil
}


func (s *ChatService) convertChatsFromProto(protoChats []*chatv1.Chat) []domain.ChatWithLastMessage {
	var chats []domain.ChatWithLastMessage
	for _, protoChat := range protoChats {
		if chat := s.convertChatFromProto(protoChat); chat != nil {
			chats = append(chats, *chat)
		}
	}
	return chats
}

func (s *ChatService) convertChatFromProto(protoChat *chatv1.Chat) *domain.ChatWithLastMessage {
	if protoChat == nil {
		return nil
	}

	chat := &domain.ChatWithLastMessage{
		ID:        utils.StringToUUID(protoChat.Id),
		User1ID:   utils.StringToUUID(protoChat.User1Id),
		User2ID:   utils.StringToUUID(protoChat.User2Id),
		CreatedAt: protoChat.CreatedAt.AsTime(),
		UpdatedAt: protoChat.UpdatedAt.AsTime(),
		IsActive:  true, 
	}

	if protoChat.LastMessage != nil {
		chat.LastMessageID = utils.UUIDPtr(utils.StringToUUID(protoChat.LastMessage.Id))
		chat.LastMessageChatID = utils.UUIDPtr(utils.StringToUUID(protoChat.LastMessage.ChatId))
		chat.LastMessageSenderID = utils.UUIDPtr(utils.StringToUUID(protoChat.LastMessage.SenderId))
		chat.LastMessageContent = &protoChat.LastMessage.Content
		chat.LastMessageType = &protoChat.LastMessage.MessageType
		chat.LastMessageCreatedAt = utils.TimePtr(protoChat.LastMessage.CreatedAt.AsTime())
		chat.LastMessageUpdatedAt = utils.TimePtr(protoChat.LastMessage.UpdatedAt.AsTime())
		chat.LastMessageIsEdited = &protoChat.LastMessage.IsEdited
		chat.LastMessageIsRead = &protoChat.LastMessage.IsRead

		if protoChat.LastMessage.ReadAt != nil {
			chat.LastMessageReadAt = utils.TimePtr(protoChat.LastMessage.ReadAt.AsTime())
		}
		
		if protoChat.LastMessage.ReplyTo != "" {
			chat.LastMessageReplyTo = utils.UUIDPtr(utils.StringToUUID(protoChat.LastMessage.ReplyTo))
		}
	}

	return chat
}

func (s *ChatService) convertMessagesResponseFromProto(protoResp *chatv1.GetChatMessagesResponse) *domain.GetChatMessagesResponse {
	if protoResp == nil {
		return &domain.GetChatMessagesResponse{
			Messages: []domain.Message{},
			HasMore:  false,
		}
	}

	resp := &domain.GetChatMessagesResponse{
		Messages: s.convertMessagesFromProto(protoResp.Messages),
		HasMore:  protoResp.HasMore,
	}

	if protoResp.NextCursor != nil {
		resp.NextCursor = &domain.Cursor{
			ID:        protoResp.NextCursor.Id,
			CreatedAt: protoResp.NextCursor.CreatedAt.AsTime(),
		}
	}

	return resp
}

func (s *ChatService) convertMessagesFromProto(protoMessages []*chatv1.Message) []domain.Message {
	var messages []domain.Message
	for _, protoMsg := range protoMessages {
		if msg := s.convertMessageFromProto(protoMsg); msg != nil {
			messages = append(messages, *msg)
		}
	}
	return messages
}

func (s *ChatService) convertMessageFromProto(protoMsg *chatv1.Message) *domain.Message {
	if protoMsg == nil {
		return nil
	}

	msg := &domain.Message{
		ID:          utils.StringToUUID(protoMsg.Id),
		ChatID:      utils.StringToUUID(protoMsg.ChatId),
		SenderID:    utils.StringToUUID(protoMsg.SenderId),
		Content:     protoMsg.Content,
		MessageType: domain.MessageType(protoMsg.MessageType),
		CreatedAt:   protoMsg.CreatedAt.AsTime(),
		UpdatedAt:   protoMsg.UpdatedAt.AsTime(),
		IsEdited:    protoMsg.IsEdited,
		IsRead:      protoMsg.IsRead,
	}

	if protoMsg.ReadAt != nil {
		msg.ReadAt = utils.TimePtr(protoMsg.ReadAt.AsTime())
	}

	if protoMsg.ReplyTo != "" {
		msg.ReplyTo = utils.UUIDPtr(utils.StringToUUID(protoMsg.ReplyTo))
	}

	if len(protoMsg.Attachments) > 0 {
		msg.Attachments = s.convertAttachmentsFromProto(protoMsg.Attachments, msg.ID)
	}

	return msg
}

func (s *ChatService) convertAttachmentsFromProto(protoAttachments []*chatv1.Attachment, messageID uuid.UUID) []domain.Attachment {
	var attachments []domain.Attachment
	for _, protoAtt := range protoAttachments {
		if protoAtt == nil {
			continue
		}

		attachment := domain.Attachment{
			ID:        utils.StringToUUID(protoAtt.Id),
			MessageID: messageID,
			URL:       protoAtt.Url,
			FileName:  protoAtt.FileName,
			MimeType:  protoAtt.MimeType,
			FileSize:  protoAtt.FileSize,
		}

		if protoAtt.Width > 0 {
			width := int(protoAtt.Width)
			attachment.Width = &width
		}
		if protoAtt.Height > 0 {
			height := int(protoAtt.Height)
			attachment.Height = &height
		}

		attachments = append(attachments, attachment)
	}
	return attachments
}

func (s *ChatService) CheckUserAccessToChat(ctx context.Context, chatId, userId string) (bool, error) {
    grpcReq := chatv1.CheckUserAccessToChatRequest{
		ChatId: chatId,
		UserId: userId,
	}

    grpcResp, err := s.chatClient.CheckUserAccessToChat(ctx, &grpcReq)
    if err != nil {
        return false, fmt.Errorf("failed to check access: %w", err)
    }

    return grpcResp.HasAccess, nil
}

