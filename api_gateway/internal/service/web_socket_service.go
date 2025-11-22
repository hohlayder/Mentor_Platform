package service

import (
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/infrastructure/repositories"
)


type ClientRepository interface {
	SaveConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error
	FindByUserID(userID uuid.UUID) (*repositories.ClientConnection, error)
	DeleteByUserID(userID uuid.UUID) error
	UpdateLastSeen(userID uuid.UUID) error
	SendMessage(userID uuid.UUID, message *domain.Message) error
	CleanupInactiveConnections(timeout time.Duration)
}

type WebSocketService struct {
	clientRepo     ClientRepository
	messageService *MessageService
}

func NewWebSocketService(clientRepo ClientRepository, messageService *MessageService) *WebSocketService {
	return &WebSocketService{
		clientRepo:     clientRepo,
		messageService: messageService,
	}
}

func (s *WebSocketService) HandleConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error {
	if err := s.clientRepo.SaveConnection(userID, conn, ipAddress); err != nil {
		slog.Error(err.Error())
		return fmt.Errorf("failed to save connection: %w", err)
	}

	go  s.startMessageSender(userID)
	log.Printf("User connected: %s", userID)
	return nil
}

func (s *WebSocketService) HandleDisconnection(userID uuid.UUID) error {
	if err := s.clientRepo.DeleteByUserID(userID); err != nil {
		return fmt.Errorf("failed to delete connection: %w", err)
	}

	log.Printf("User disconnected: %s", userID)
	return nil
}

func (s *WebSocketService) HandleMessage(message *domain.Message) error {
	slog.Info("handle message start")
	if err := s.clientRepo.UpdateLastSeen(message.SenderID); err != nil {
		return fmt.Errorf("failed to update last seen: %w", err)
	}

	return s.messageService.SendMessageInstantly(message)
}

func (s *WebSocketService) CleanupInactiveConnections(timeout time.Duration) {
	s.clientRepo.CleanupInactiveConnections(timeout)
}

func (s *WebSocketService) startMessageSender(userID uuid.UUID) {
	clientConn, err := s.clientRepo.FindByUserID(userID)
	if err != nil {
		log.Printf("Failed to find client for user %s: %v", userID, err)
		return
	}

	ticker := time.NewTicker(30 * time.Second) // изменить на значение из конфига
    defer func() {
        ticker.Stop()
        clientConn.Conn.Close()
    }()
    
    for {
        select {
        case message, ok := <-clientConn.SendChan:
            if !ok {
				s.clientRepo.DeleteByUserID(userID)
                clientConn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            
			slog.Info("writing message to websocket", "userID", userID, "messageID", message.ID)
            if err := clientConn.Conn.WriteJSON(message); err != nil {
                log.Printf("Failed to send message to user %s: %v", clientConn.Client.UserID, err)
                return
            }
            
            log.Printf("Message sent to user %s: %s", clientConn.Client.UserID, message.ID)
            
        case <-ticker.C:
            if err := clientConn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}