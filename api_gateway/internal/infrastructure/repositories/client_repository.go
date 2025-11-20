// api-gateway/internal/repositories/client_repository.go
package repositories

import (
	"fmt"
	"log"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

type ClientConnection struct {
	Client   *domain.Client
	Conn     *websocket.Conn
	SendChan chan *domain.Message
}

type InMemoryClientRepository struct {
	clients map[uuid.UUID]*ClientConnection
	mu      sync.RWMutex
}

func NewInMemoryClientRepository() *InMemoryClientRepository {
	return &InMemoryClientRepository{
		clients: make(map[uuid.UUID]*ClientConnection),
	}
}

func (r *InMemoryClientRepository) SaveConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error {
	slog.Info("SaveConnection called", "userID", userID)
	r.mu.Lock()
	defer r.mu.Unlock()

	if existing, exists := r.clients[userID]; exists {
		close(existing.SendChan)
		existing.Conn.Close()
	}

	r.clients[userID] = &ClientConnection{
		Client: &domain.Client{
			ID:        fmt.Sprintf("conn_%s", userID.String()),
			UserID:    userID,
			IPAddress: ipAddress,
			Connected: time.Now(),
			LastSeen:  time.Now(),
		},
		Conn:     conn,
		SendChan: make(chan *domain.Message, 100),
	}
	return nil
}

func (r *InMemoryClientRepository) FindByUserID(userID uuid.UUID) (*ClientConnection, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	client, exists := r.clients[userID]
	if !exists {
		return nil, fmt.Errorf("client not found for user: %s", userID)
	}
	return client, nil
}

func (r *InMemoryClientRepository) DeleteByUserID(userID uuid.UUID) error {
	slog.Info("DeleteByUserID called", "userID", userID, "stack", string(debug.Stack()))
	r.mu.Lock()
	defer r.mu.Unlock()

	if client, exists := r.clients[userID]; exists {
		close(client.SendChan)
		client.Conn.Close()
		delete(r.clients, userID)
	}
	return nil
}

func (r *InMemoryClientRepository) FindAll() ([]*ClientConnection, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	clients := make([]*ClientConnection, 0, len(r.clients))
	for _, client := range r.clients {
		clients = append(clients, client)
	}
	return clients, nil
}

func (r *InMemoryClientRepository) UpdateLastSeen(userID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if client, exists := r.clients[userID]; exists {
		client.Client.LastSeen = time.Now()
	}
	return nil
}

func (r *InMemoryClientRepository) SendMessage(userID uuid.UUID, message *domain.Message) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	client, exists := r.clients[userID]
	if !exists {
		return fmt.Errorf("user %s is not connected", userID)
	}

	client.Client.LastSeen = time.Now()
	
	select {
	case client.SendChan <- message:
		return nil
	case <- time.After(100 * time.Millisecond):
		return fmt.Errorf("user %s message buffer is full", userID)
	}
}

func (r *InMemoryClientRepository) IsUserOnline(userID uuid.UUID) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, exists := r.clients[userID]
	return exists
}

func (r *InMemoryClientRepository) CleanupInactiveConnections(timeout time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for userID, client := range r.clients {
		if now.Sub(client.Client.LastSeen) > timeout {
			close(client.SendChan)
			client.Conn.Close()
			delete(r.clients, userID)
			log.Printf("Cleaned up inactive connection for user: %s", userID)
		}
	}
}