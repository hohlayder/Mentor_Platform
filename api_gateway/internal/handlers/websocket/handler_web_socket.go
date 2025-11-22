package websocket

import (
	"log"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type IncomingMessage struct {
	ChatID      uuid.UUID           `json:"chat_id"`
	Content     string              `json:"content"`
	ReplyTo     *uuid.UUID          `json:"reply_to,omitempty"`
	MessageType domain.MessageType  `json:"message_type"`
	Attachments []domain.Attachment `json:"attachments,omitempty"`
}

type MessageService interface {
	SendMessageInstantly(message *domain.Message) error
}

type WebSocketService interface {
	HandleConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error
	HandleDisconnection(userID uuid.UUID) error
	HandleMessage(message *domain.Message) error
}

type WebSocketHandler struct {
	websocketService WebSocketService
	messageService   MessageService
}

func NewWebSocketHandler(websocketService WebSocketService, messageService MessageService) *WebSocketHandler {
	return &WebSocketHandler{
		websocketService: websocketService,
		messageService:   messageService,
	}
}

func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	userIDStr, ok := userIDInterface.(string)
	if !ok || userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID format",
		})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to upgrade to WebSocket",
		})
		return
	}

	if err := h.websocketService.HandleConnection(userID, conn, c.ClientIP()); err != nil {
		conn.WriteJSON(map[string]string{"error": err.Error()})
		conn.Close()
		return
	}

	log.Printf("WebSocket connection established for user: %s", userID)
	
	go h.handleClientMessages(userID, conn)
}

func (h *WebSocketHandler) handleClientMessages(userID uuid.UUID, conn *websocket.Conn) {
	defer func() {
		h.websocketService.HandleDisconnection(userID)
		conn.Close()
	}()

	for {
		var incomingMsg IncomingMessage
		err := conn.ReadJSON(&incomingMsg)
		if err != nil {
			slog.Info(err.Error())
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("WebSocket read error", "user_id", userID, "error", err)
			}
			break
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

		if err := h.websocketService.HandleMessage(message); err != nil {
			errorMsg := map[string]interface{}{
				"type":  "error",
				"error": err.Error(),
			}
			conn.WriteJSON(errorMsg)
		}
	}
}
