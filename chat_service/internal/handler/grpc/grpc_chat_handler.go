package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ChatService interface {
	CreateChat(ctx context.Context, userId string, otherUserId string) (string, error)
	GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error)
    GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error)
	GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error)
	MarkMessagesRead(ctx context.Context, chatId string, messagesIDs []string) error
    CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error)
}

type ChatHandler struct {
	service ChatService
	chatv1.UnimplementedChatServiceServer
}

func NewChatHandler(service ChatService) *ChatHandler {
	return &ChatHandler{service: service}
}

func (h *ChatHandler) RegisterServer(server *grpc.Server) {
	chatv1.RegisterChatServiceServer(server, h)
}

func (h *ChatHandler) CreateChat(ctx context.Context, req *chatv1.CreateChatRequest) (*chatv1.CreateChatResponse, error) {
	chatId, err := h.service.CreateChat(ctx, req.UserId, req.OtherUserId)
	if err != nil {
        slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to create user chat")
	}

	resp := chatv1.CreateChatResponse{
		ChatId: chatId,
	}

	return &resp, nil
}

func (h *ChatHandler) GetUserChats(ctx context.Context, req *chatv1.GetUserChatsRequest) (*chatv1.GetUserChatsResponse, error) {
	chats, err := h.service.GetUserChats(ctx, req.UserId, req.Limit, req.Offset)
	if err != nil {
        slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to get messages")
	}

	var chatsResp []*chatv1.Chat

    for _, chat := range chats {
        chatProto := &chatv1.Chat{
            Id:         chat.ID.String(),
            User1Id:    chat.User1ID.String(),
            User2Id:    chat.User2ID.String(),
            CreatedAt:  timestamppb.New(chat.CreatedAt),
            UpdatedAt:  timestamppb.New(chat.UpdatedAt),
            UnreadCount: 0,
            LastMessage: &chatv1.Message{

            },
        }
        if chat.LastMessageID != nil {
            chatProto.LastMessage.Id = chat.LastMessageID.String()
        }

        if chat.LastMessageChatID != nil {
            chatProto.LastMessage.ChatId = chat.LastMessageChatID.String()
        }

        if chat.LastMessageSenderID != nil {
            chatProto.LastMessage.SenderId = chat.LastMessageSenderID.String()
        }

        if chat.LastMessageReplyTo != nil {
            chatProto.LastMessage.ReplyTo = chat.LastMessageReplyTo.String()
        }

        if chat.LastMessageCreatedAt != nil {
            chatProto.LastMessage.CreatedAt = timestamppb.New(*chat.LastMessageCreatedAt)
        }

        if chat.LastMessageUpdatedAt != nil {
            chatProto.LastMessage.UpdatedAt = timestamppb.New(*chat.LastMessageUpdatedAt)
        }

        if chat.LastMessageReadAt != nil {
            chatProto.LastMessage.ReadAt = timestamppb.New(*chat.LastMessageReadAt)
        }

        if chat.LastMessageContent != nil {
            chatProto.LastMessage.Content = *chat.LastMessageContent
        }

        if chat.LastMessageType != nil {
            chatProto.LastMessage.MessageType = *chat.LastMessageType
        }

        if chat.LastMessageIsEdited != nil {
            chatProto.LastMessage.IsEdited = *chat.LastMessageIsEdited
        }

        if chat.LastMessageIsRead != nil {
            chatProto.LastMessage.IsRead = *chat.LastMessageIsRead
        }
        

        chatsResp = append(chatsResp, chatProto)
	}
	resp := chatv1.GetUserChatsResponse{
		Chats: chatsResp,
	}	
	
	return &resp, nil
}

func (h *ChatHandler) GetChatById(ctx context.Context, req *chatv1.GetChatByIdRequest) (*chatv1.GetChatByIdResponse, error) {
    slog.Info("start method get chat by id")
    chat, err := h.service.GetChatById(ctx, req.Id)
    if err != nil {
        slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to get chat")
    }

    chatProto := &chatv1.Chat{
        Id:         chat.ID.String(),
        User1Id:    chat.User1ID.String(),
        User2Id:    chat.User2ID.String(),
        CreatedAt:  timestamppb.New(chat.CreatedAt),
        UpdatedAt:  timestamppb.New(chat.UpdatedAt),
        UnreadCount: 0,
        LastMessage: &chatv1.Message{

        }, 
    }

    if chat.LastMessageID != nil {
        chatProto.LastMessage.Id = chat.LastMessageID.String()
    }

    if chat.LastMessageChatID != nil {
        chatProto.LastMessage.ChatId = chat.LastMessageChatID.String()
    }

    if chat.LastMessageSenderID != nil {
        chatProto.LastMessage.SenderId = chat.LastMessageSenderID.String()
    }

    if chat.LastMessageReplyTo != nil {
        chatProto.LastMessage.ReplyTo = chat.LastMessageReplyTo.String()
    }

    if chat.LastMessageCreatedAt != nil {
        chatProto.LastMessage.CreatedAt = timestamppb.New(*chat.LastMessageCreatedAt)
    }

    if chat.LastMessageUpdatedAt != nil {
        chatProto.LastMessage.UpdatedAt = timestamppb.New(*chat.LastMessageUpdatedAt)
    }

    if chat.LastMessageReadAt != nil {
        chatProto.LastMessage.ReadAt = timestamppb.New(*chat.LastMessageReadAt)
    }

    if chat.LastMessageContent != nil {
        chatProto.LastMessage.Content = *chat.LastMessageContent
    }

    if chat.LastMessageType != nil {
        chatProto.LastMessage.MessageType = *chat.LastMessageType
    }

    if chat.LastMessageIsEdited != nil {
        chatProto.LastMessage.IsEdited = *chat.LastMessageIsEdited
    }

    if chat.LastMessageIsRead != nil {
        chatProto.LastMessage.IsRead = *chat.LastMessageIsRead
    }

    resp := chatv1.GetChatByIdResponse{
        Chat: chatProto,
    }

    return &resp, nil
}

func (h *ChatHandler) GetChatMessages(ctx context.Context, req *chatv1.GetChatMessagesRequest) (*chatv1.GetChatMessagesResponse, error) {
    var cursor *domain.Cursor

    if req.Cursor != nil {
        cursorId, err := uuid.Parse(req.Cursor.Id)
        if err != nil {
            return nil, fmt.Errorf("failed to parse cursor id: %w", err)
        }

        createdAt := req.Cursor.CreatedAt
        cursor = &domain.Cursor{
            ID:        cursorId,
            CreatedAt: createdAt.AsTime(),
        }
    }

	messageResp, err := h.service.GetChatMessages(ctx, req.ChatId, req.Limit, cursor)
	if err != nil {
        slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to get chat messages")
	}

	var messages []*chatv1.Message
    for _, message := range messageResp.Messages {
        var attachments []*chatv1.Attachment
        for _, attch := range message.Attachments {
            attachment := &chatv1.Attachment{
                Id:       attch.ID.String(),
                Url:      attch.URL,
                FileName: attch.FileName,
                MimeType: attch.MimeType,
                FileSize: attch.FileSize,
            }

            if attch.Width != nil {
                attachment.Width = int32(*attch.Width)
            }
            if attch.Height != nil {
                attachment.Height = int32(*attch.Height)
            }
            
            attachments = append(attachments, attachment)
        }

        var replyTo string
        if message.ReplyTo != nil {
            replyTo = message.ReplyTo.String()
        }

        var readAt *timestamppb.Timestamp
        if message.ReadAt != nil {
            readAt = timestamppb.New(*message.ReadAt)
        }

        msg := &chatv1.Message{
            Id:          message.ID.String(),
            ChatId:      message.ChatID.String(),
            SenderId:    message.SenderID.String(),
            Content:     message.Content,
            MessageType: string(message.MessageType),
            Attachments: attachments,
            ReplyTo:     replyTo,
            CreatedAt:   timestamppb.New(message.CreatedAt),
            UpdatedAt:   timestamppb.New(message.UpdatedAt),
            IsEdited:    message.IsEdited,
            IsRead:      message.IsRead,
            ReadAt:      readAt,
        }

        messages = append(messages, msg)
	}

	var nextCursor *chatv1.Cursor
    if messageResp.NextCursor != nil {
        nextCursor = &chatv1.Cursor{
            Id:        messageResp.NextCursor.ID.String(),
            CreatedAt: timestamppb.New(messageResp.NextCursor.CreatedAt),
        }
    }

	grpcResp := chatv1.GetChatMessagesResponse{
		Messages: messages,
		NextCursor: nextCursor,
		HasMore: messageResp.HasMore,
	}

	return &grpcResp, nil
}

func (h *ChatHandler) MarkMessagesRead(ctx context.Context, req *chatv1.MarkMessagesReadRequest) (*chatv1.MarkMessagesReadResponse, error) {
	err := h.service.MarkMessagesRead(ctx, req.ChatId, req.MessageIds)
	if err != nil {
        slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to mark message read")
	}

	return &chatv1.MarkMessagesReadResponse{
		Success: true,
	}, nil
}

func (h *ChatHandler) CheckUserAccessToChat(ctx context.Context, req *chatv1.CheckUserAccessToChatRequest) (*chatv1.CheckUserAccessToChatResponse, error) {
	hasAccess, err := h.service.CheckUserAccessToChat(ctx, req.ChatId, req.UserId)
	if err != nil {
		slog.Error("failed to check user access to chat", "error", err, "chat_id", req.ChatId, "user_id", req.UserId)
		
		if errors.Is(err, domain.ErrInvalidChatID) {
			return nil, status.Error(codes.InvalidArgument, "invalid chat id or user id")
		}
		if errors.Is(err, domain.ErrAccessDenied) {
			return nil, status.Error(codes.PermissionDenied, "access denied to chat")
		}
		
		return nil, status.Error(codes.Internal, "failed to check access to chat")
	}

	return &chatv1.CheckUserAccessToChatResponse{
		HasAccess: hasAccess,
	}, nil
}