package handlers

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
)

type ChatService interface {
	CreateChat(ctx context.Context, userId string, otherUserId string) (string, error)
	GetUserChats(ctx context.Context, userId string, limit int32, before int32) ([]domain.ChatWithLastMessage, error)
	GetChatById(ctx context.Context, chatId string) (*domain.ChatWithLastMessage, error)
	GetChatMessages(ctx context.Context, chatId string, limit int32, cursor *domain.Cursor) (*domain.GetChatMessagesResponse, error)
	MarkMessagesRead(ctx context.Context, chatId, userId string, messagesIDs []string) error
	CheckUserAccessToChat(ctx context.Context, chatID string, userID string) (bool, error)
}

type ChatHandler struct {
	service ChatService
}

func NewChatHandler(service ChatService) *ChatHandler {
	return &ChatHandler{service: service}
}

// CreateChat создает новый чат
// @Summary Создать чат
// @Description Создает новый чат между двумя пользователями
// @Tags chats
// @Accept json
// @Produce json
// @Param request body domain.CreateChatRequest true "Данные для создания чата"
// @Security BearerAuth
// @Success 201 {object} domain.CreateChatResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /chats [post]
func (h *ChatHandler) CreateChat(c *gin.Context) {
	var req domain.CreateChatRequest
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	chatID, err := h.service.CreateChat(c.Request.Context(), userId, req.OtherUserID)
	if err != nil {
		slog.Error("Failed to create chat", "error", err)
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to create chat",
		})
		return
	}

	resp := domain.CreateChatResponse{
		ChatID: chatID,
	}

	c.JSON(http.StatusCreated, resp)
}

// GetUserChats возвращает список чатов пользователя
// @Summary Получить чаты пользователя
// @Description Возвращает список чатов пользователя с последними сообщениями
// @Tags chats
// @Produce json
// @Param limit query int false "Лимит чатов" default(20)
// @Param offset query int false "Смещение" default(0)
// @Security BearerAuth
// @Success 200 {object} domain.GetUserChatsResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 403 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /chats [get]
func (h *ChatHandler) GetUserChats(c *gin.Context) {
	var req domain.GetUserChatsRequest
	userId, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return
	}

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid query parameters",
			Details: err.Error(),
		})
		return
	}

	chats, err := h.service.GetUserChats(c.Request.Context(), userId, req.Limit, req.Offset)
	if err != nil {
		slog.Error("Failed to get user chats", "error", err)
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get user chats",
		})
		return
	}

	var chatsResp []domain.ChatResponse
	for _, chat := range chats {
		chatResp := domain.ChatResponse{
			ID:          chat.ID.String(),
			User1ID:     chat.User1ID.String(),
			User2ID:     chat.User2ID.String(),
			CreatedAt:   chat.CreatedAt,
			UpdatedAt:   chat.UpdatedAt,
			UnreadCount: 0, 
		}

		if chat.LastMessageID != nil {
			chatResp.LastMessage = &domain.Message{
				ID:          *chat.LastMessageID,
				ChatID:      *chat.LastMessageChatID,
				SenderID:    *chat.LastMessageSenderID,
				Content:     *chat.LastMessageContent,
				MessageType: domain.MessageType(*chat.LastMessageType),
				CreatedAt:   *chat.LastMessageCreatedAt,
				UpdatedAt:   *chat.LastMessageUpdatedAt,
				IsEdited:    *chat.LastMessageIsEdited,
				IsRead:      *chat.LastMessageIsRead,
			}

			if chat.LastMessageReadAt != nil {
				chatResp.LastMessage.ReadAt = chat.LastMessageReadAt
			}
			if chat.LastMessageReplyTo != nil {
				chatResp.LastMessage.ReplyTo = chat.LastMessageReplyTo
			}
		}

		chatsResp = append(chatsResp, chatResp)
	}

	resp := domain.GetUserChatsResponse{
		Chats: chatsResp,
	}

	c.JSON(http.StatusOK, resp)
}

// GetChatById возвращает чат по ID
// @Summary Получить чат по ID
// @Description Возвращает информацию о чате по его идентификатору
// @Tags chats
// @Produce json
// @Param id path string true "ID чата"
// @Security BearerAuth
// @Success 200 {object} domain.GetChatByIdResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 403 {object} utils.ErrorResponse
// @Failure 404 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /chats/{id} [get]
func (h *ChatHandler) GetChatById(c *gin.Context) {
	chatID := c.Param("id")
	userId, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return 
	}


	chat, err := h.service.GetChatById(c.Request.Context(), chatID)
	slog.Info("chat response", "chat", chat)
	if err != nil {
		slog.Error("Failed to get chat by id", "error", err)
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get chat",
		})
		return
	}

	if chat.User1ID.String() != userId && chat.User2ID.String() != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error: "FORBIDDEN_ERROR",
			Message: "The user is not a member of the chat",
		})
		return 
	}

	chatResp := domain.ChatResponse{
		ID:          chat.ID.String(),
		User1ID:     chat.User1ID.String(),
		User2ID:     chat.User2ID.String(),
		CreatedAt:   chat.CreatedAt,
		UpdatedAt:   chat.UpdatedAt,
		UnreadCount: 0,
	}

	if chat.LastMessageID != nil {
		chatResp.LastMessage = &domain.Message{
			ID:          *chat.LastMessageID,
			ChatID:      *chat.LastMessageChatID,
			SenderID:    *chat.LastMessageSenderID,
			Content:     *chat.LastMessageContent,
			MessageType: domain.MessageType(*chat.LastMessageType),
			CreatedAt:   *chat.LastMessageCreatedAt,
			UpdatedAt:   *chat.LastMessageUpdatedAt,
			IsEdited:    *chat.LastMessageIsEdited,
			IsRead:      *chat.LastMessageIsRead,
		}

		if chat.LastMessageReadAt != nil {
			chatResp.LastMessage.ReadAt = chat.LastMessageReadAt
		}
		if chat.LastMessageReplyTo != nil {
			chatResp.LastMessage.ReplyTo = chat.LastMessageReplyTo
		}
	}

	resp := domain.GetChatByIdResponse{
		Chat: chatResp,
	}

	c.JSON(http.StatusOK, resp)
}

// GetChatMessages возвращает сообщения чата
// @Summary Получить сообщения чата
// @Description Возвращает сообщения чата с пагинацией
// @Tags chats
// @Produce json
// @Param chat_id query string true "ID чата"
// @Param limit query int false "Лимит сообщений" default(50)
// @Param cursor query string false "Курсор для пагинации"
// @Security BearerAuth
// @Success 200 {object} domain.GetChatMessagesResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /chats/messages [get]
func (h *ChatHandler) GetChatMessages(c *gin.Context) {
	var req domain.GetChatMessagesRequest
	
	userId, exists := utils.GetUserIdFromContext(c) 
	if !exists {
		return
	}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid query parameters",
			Details: err.Error(),
		})
		return
	}

	var cursor *domain.Cursor
	var err error
	if req.Cursor != "" {
		cursor, err = utils.ParseCursor(req.Cursor)
		if err != nil {
			c.JSON(http.StatusBadRequest, utils.ErrorResponse{
				Error:   "INVALID_CURSOR",
				Message: "Invalid cursor format",
				Details: err.Error(),
			})
			return
		}
	}

	access, err := h.service.CheckUserAccessToChat(c.Request.Context(), req.ChatID, userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error: "INTERNAL_ERROR",
			Message: "Failed to check the permission",
		})
		return
	}

	if !access {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error: "FORBIDDEN_ERROR",
			Message: "The user is not a member of the chat",
		})
		return
	}

	messages, err := h.service.GetChatMessages(c.Request.Context(), req.ChatID, req.Limit, cursor)
	if err != nil {
		slog.Error("Failed to get chat messages", "error", err)
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get chat messages",
		})
		return
	}

	if messages.NextCursor != nil {
		encodedCursor, err := utils.EncodeCursor(messages.NextCursor)
		if err != nil {
			slog.Error("Failed to encode cursor", "error", err)
		} else {
			messages.NextCursor = &domain.Cursor{
				ID:        encodedCursor,
				CreatedAt: messages.NextCursor.CreatedAt,
			}
		}
	}

	c.JSON(http.StatusOK, messages)
}

// MarkMessagesRead помечает сообщения как прочитанные
// @Summary Пометить сообщения как прочитанные
// @Description Помечает указанные сообщения как прочитанные
// @Tags chats
// @Accept json
// @Produce json
// @Param request body domain.MarkMessagesReadRequest true "Запрос содержит ID чата и список ID сообщений для отметки как прочитанные"
// @Security BearerAuth
// @Success 200 {object} domain.MarkMessagesReadResponse
// @Failure 400 {object} utils.ErrorResponse
// @Failure 401 {object} utils.ErrorResponse
// @Failure 403 {object} utils.ErrorResponse
// @Failure 500 {object} utils.ErrorResponse
// @Router /chats/messages/read [post]
func (h *ChatHandler) MarkMessagesRead(c *gin.Context) {
	var req domain.MarkMessagesReadRequest
	userId, exists := utils.GetUserIdFromContext(c)
	if !exists {
		return 
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	access, err := h.service.CheckUserAccessToChat(c.Request.Context(), req.ChatId, userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error: "INTERNAL_ERROR",
			Message: "Failed to check the permission",
		})
		return
	}

	if !access {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error: "FORBIDDEN_ERROR",
			Message: "The user is not a member of the chat",
		})
		return
	}

	err = h.service.MarkMessagesRead(c.Request.Context(), req.ChatId, userId, req.MessageIDs)
	if err != nil {
		slog.Error("Failed to mark messages as read", "error", err)
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to mark messages as read",
		})
		return
	}

	resp := domain.MarkMessagesReadResponse{
		Success: true,
	}

	c.JSON(http.StatusOK, resp)
}

