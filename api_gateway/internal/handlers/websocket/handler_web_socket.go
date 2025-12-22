package websocket

import (
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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
	GetGoroutineStats() map[string]interface{}
	IsUserConnected(userID uuid.UUID) bool
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

type CustomClaims struct {
	UserId string `json:"UserId"`
	jwt.RegisteredClaims
	TokenType string `json:"type"`
}

func ParseToken(tokenString string) (*CustomClaims, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET not configured")
	}

	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*CustomClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	token := c.Query("token")

	if token == "" {
		subprotocols := c.Request.Header["Sec-WebSocket-Protocol"]
		for _, protocol := range subprotocols {
			if len(protocol) > 7 && protocol[:7] == "Bearer " {
				token = protocol[7:]
				break
			} else if len(protocol) > 0 {
				token = protocol
				break
			}
		}
	}

	if token == "" {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authorization token required",
			"hint":  "Use WebSocket URL: ws://localhost:8080/ws?token=YOUR_JWT_TOKEN",
		})
		return
	}

	claims, err := ParseToken(token)
	if err != nil {
		log.Printf("Token validation failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid or expired token",
		})
		return
	}

	if claims.TokenType != "access" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Access token required",
		})
		return
	}

	userID, err := uuid.Parse(claims.UserId)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{
            "error": "Invalid user ID format in token",
        })
        return
    }
    
    c.Set("user_id", claims.UserId)
    
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        log.Printf("WebSocket upgrade error: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to upgrade to WebSocket",
        })
        return
    }
    
    // Логируем статистику перед подключением
    stats := h.websocketService.GetGoroutineStats()
    slog.Info("Before connection",
        "userID", userID,
        "active_goroutines", stats["active_goroutines"],
        "user_connected", h.websocketService.IsUserConnected(userID))
    
    if err := h.websocketService.HandleConnection(userID, conn, c.ClientIP()); err != nil {
        conn.WriteJSON(map[string]string{"error": err.Error()})
        conn.Close()
        
        // Логируем ошибку
        slog.Error("HandleConnection failed",
            "userID", userID,
            "error", err,
            "active_goroutines", stats["active_goroutines"])
        return
    }
    
    // Логируем статистику после подключения
    stats = h.websocketService.GetGoroutineStats()
    slog.Info("Connection established",
        "userID", userID,
        "active_goroutines", stats["active_goroutines"],
        "total_created", stats["total_created"])
    
    go h.handleClientMessages(userID, conn)
}

func (h *WebSocketHandler) handleClientMessages(userID uuid.UUID, conn *websocket.Conn) {
    defer func() {
        // Всегда вызываем отключение
        if err := h.websocketService.HandleDisconnection(userID); err != nil {
            slog.Warn("HandleDisconnection returned error",
                "userID", userID,
                "error", err)
        }
        
        // Логируем статистику после отключения
        stats := h.websocketService.GetGoroutineStats()
        slog.Info("After disconnection",
            "userID", userID,
            "active_goroutines", stats["active_goroutines"],
            "total_stopped", stats["total_stopped"])
    }()
    
    for {
        var incomingMsg IncomingMessage
        err := conn.ReadJSON(&incomingMsg)
        if err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                slog.Error("Unexpected WebSocket close",
                    "user_id", userID,
                    "error", err)
            } else {
                slog.Info("WebSocket read error (normal closure)",
                    "user_id", userID,
                    "error", err)
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