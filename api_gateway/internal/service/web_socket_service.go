package service

import (
    "context"
    "fmt"
    "log"
    "log/slog"
    "sync"
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

// Структура для управления горутиной
type goroutineManager struct {
    cancelFunc context.CancelFunc
    stopped    chan struct{}
}

// WebSocketService с полным управлением горутинами
type WebSocketService struct {
    clientRepo     ClientRepository
    messageService *MessageService
    
    // Управление горутинами
    goroutines map[uuid.UUID]*goroutineManager
    mu         sync.RWMutex
    
    // Мониторинг
    stats struct {
        totalGoroutinesCreated int
        totalGoroutinesStopped int
        mu sync.RWMutex
    }
}

func NewWebSocketService(clientRepo ClientRepository, messageService *MessageService) *WebSocketService {
    service := &WebSocketService{
        clientRepo:     clientRepo,
        messageService: messageService,
        goroutines:     make(map[uuid.UUID]*goroutineManager),
    }
    
    // Запускаем мониторинг
    go service.startMonitoring()
    
    return service
}

// HandleConnection теперь полностью управляет жизненным циклом горутин
func (s *WebSocketService) HandleConnection(userID uuid.UUID, conn *websocket.Conn, ipAddress string) error {
    // 1. Останавливаем предыдущую горутину для этого пользователя
    s.stopGoroutine(userID)
    
    // 2. Сохраняем соединение в репозитории
    if err := s.clientRepo.SaveConnection(userID, conn, ipAddress); err != nil {
        slog.Error("Failed to save connection", "userID", userID, "error", err)
        return fmt.Errorf("failed to save connection: %w", err)
    }
    
    // 3. Создаем контекст с отменой для новой горутины
    ctx, cancel := context.WithCancel(context.Background())
    manager := &goroutineManager{
        cancelFunc: cancel,
        stopped:    make(chan struct{}, 1),
    }
    
    // 4. Сохраняем менеджер горутины
    s.mu.Lock()
    s.goroutines[userID] = manager
    s.mu.Unlock()
    
    // 5. Обновляем статистику
    s.stats.mu.Lock()
    s.stats.totalGoroutinesCreated++
    s.stats.mu.Unlock()
    
    // 6. Запускаем горутину
    go s.startMessageSender(ctx, userID, manager.stopped)
    
    log.Printf("User connected: %s (goroutine started)", userID)
    return nil
}

// HandleDisconnection - идемпотентный метод для отключения
func (s *WebSocketService) HandleDisconnection(userID uuid.UUID) error {
    // 1. Проверяем, существует ли еще горутина для этого пользователя
    s.mu.RLock()
    _, exists := s.goroutines[userID]
    s.mu.RUnlock()
    
    // Если горутины нет, значит соединение уже обработано
    if !exists {
        slog.Info("Connection already handled", "userID", userID)
        return nil
    }
    
    // 2. Останавливаем горутину
    s.stopGoroutine(userID)
    
    // 3. Удаляем из репозитория (игнорируем ошибку, если уже удалено)
    if err := s.clientRepo.DeleteByUserID(userID); err != nil {
        slog.Warn("Failed to delete connection", "userID", userID, "error", err)
    }
    
    log.Printf("User disconnected: %s", userID)
    return nil
}

// startMessageSender с полным контролем жизненного цикла
func (s *WebSocketService) startMessageSender(ctx context.Context, userID uuid.UUID, stopped chan struct{}) {
    defer func() {
        // Гарантируем, что сигнализируем о завершении
        select {
        case stopped <- struct{}{}:
        default:
        }
        
        // Обновляем статистику
        s.stats.mu.Lock()
        s.stats.totalGoroutinesStopped++
        s.stats.mu.Unlock()
        
        slog.Info("Message sender stopped", "userID", userID)
    }()
    
    slog.Info("Message sender started", "userID", userID)
    
    // Ждем немного перед началом работы
    select {
    case <-time.After(100 * time.Millisecond):
    case <-ctx.Done():
        slog.Info("Context cancelled before start", "userID", userID)
        return
    }
    
    // Получаем соединение
    clientConn, err := s.clientRepo.FindByUserID(userID)
    if err != nil {
        slog.Warn("Failed to find client connection", "userID", userID, "error", err)
        return
    }
    
    // Настраиваем таймер для ping
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    // Основной цикл обработки
    for {
        select {
        case <-ctx.Done():
            slog.Info("Context cancelled", "userID", userID)
            return
            
        case message, ok := <-clientConn.SendChan:
            if !ok {
                slog.Info("Send channel closed", "userID", userID)
                return
            }
            
            // Отправляем сообщение
            slog.Debug("Sending message", "userID", userID, "messageID", message.ID)
            if err := clientConn.Conn.WriteJSON(message); err != nil {
                slog.Warn("Failed to send message", "userID", userID, "error", err)
                return
            }
            
            slog.Info("Message sent successfully", "userID", userID, "messageID", message.ID)
            
        case <-ticker.C:
            // Отправляем ping, проверяем соединение
            select {
            case <-ctx.Done():
                return
            default:
                if err := clientConn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                    slog.Warn("Ping failed", "userID", userID, "error", err)
                    return
                }
                slog.Debug("Ping sent", "userID", userID)
            }
        }
    }
}

// stopGoroutine - безопасная остановка горутины
func (s *WebSocketService) stopGoroutine(userID uuid.UUID) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    manager, exists := s.goroutines[userID]
    if !exists {
        return
    }
    
    // Вызываем cancel функцию
    if manager.cancelFunc != nil {
        manager.cancelFunc()
    }
    
    // Ждем подтверждения остановки (с таймаутом)
    if manager.stopped != nil {
        select {
        case <-manager.stopped:
            slog.Debug("Goroutine stopped confirmed", "userID", userID)
        case <-time.After(2 * time.Second):
            slog.Warn("Goroutine stop timeout", "userID", userID)
        }
    }
    
    // Удаляем из мапы
    delete(s.goroutines, userID)
    slog.Debug("Goroutine manager cleaned up", "userID", userID)
}

// HandleMessage остается без изменений
func (s *WebSocketService) HandleMessage(message *domain.Message) error {
    slog.Debug("Handling message", "senderID", message.SenderID, "messageID", message.ID)
    
    if err := s.clientRepo.UpdateLastSeen(message.SenderID); err != nil {
        return fmt.Errorf("failed to update last seen: %w", err)
    }
    
    return s.messageService.SendMessageInstantly(message)
}

func (s *WebSocketService) CleanupInactiveConnections(timeout time.Duration) {
    s.clientRepo.CleanupInactiveConnections(timeout)
}

// Методы мониторинга и статистики
// GetGoroutineStats возвращает статистику по горутинам
func (s *WebSocketService) GetGoroutineStats() map[string]interface{} {
    s.mu.RLock()
    activeCount := len(s.goroutines)
    userIDs := make([]string, 0, activeCount)
    for userID := range s.goroutines {
        userIDs = append(userIDs, userID.String())
    }
    s.mu.RUnlock()
    
    s.stats.mu.RLock()
    defer s.stats.mu.RUnlock()
    
    return map[string]interface{}{
        "active_goroutines":        activeCount,
        "total_created":            s.stats.totalGoroutinesCreated,
        "total_stopped":            s.stats.totalGoroutinesStopped,
        "active_users":             userIDs,
        "goroutines_leak_detected": s.stats.totalGoroutinesCreated - s.stats.totalGoroutinesStopped - activeCount,
    }
}

// GetActiveUsers возвращает список активных пользователей
func (s *WebSocketService) GetActiveUsers() []uuid.UUID {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    users := make([]uuid.UUID, 0, len(s.goroutines))
    for userID := range s.goroutines {
        users = append(users, userID)
    }
    return users
}

// IsUserConnected проверяет, подключен ли пользователь
func (s *WebSocketService) IsUserConnected(userID uuid.UUID) bool {
    s.mu.RLock()
    _, exists := s.goroutines[userID]
    s.mu.RUnlock()
    return exists
}

// startMonitoring запускает мониторинг горутин
func (s *WebSocketService) startMonitoring() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            stats := s.GetGoroutineStats()
            
            // Проверяем на утечки горутин
            if leak, ok := stats["goroutines_leak_detected"].(int); ok && leak > 0 {
                slog.Error("GOROUTINE LEAK DETECTED!", 
                    "leak_count", leak,
                    "active", stats["active_goroutines"],
                    "total_created", stats["total_created"],
                    "total_stopped", stats["total_stopped"])
            }
            
            // Логируем статистику
            slog.Info("Goroutine monitoring stats",
                "active", stats["active_goroutines"],
                "total_created", stats["total_created"],
                "total_stopped", stats["total_stopped"],
                "active_users_count", len(stats["active_users"].([]string)))
            
            // Детальный лог при отладке
            if slog.Default().Enabled(context.Background(), slog.LevelDebug) {
                activeUsers := stats["active_users"].([]string)
                if len(activeUsers) > 0 {
                    slog.Debug("Active users", "users", activeUsers)
                }
            }
        }
    }
}

// ForceCleanup принудительно останавливает все горутины
func (s *WebSocketService) ForceCleanup() map[string]int {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    stoppedCount := 0
    timeoutCount := 0
    
    for userID, manager := range s.goroutines {
        // Вызываем cancel функцию
        if manager.cancelFunc != nil {
            manager.cancelFunc()
        }
        
        // Ждем подтверждения
        if manager.stopped != nil {
            select {
            case <-manager.stopped:
                stoppedCount++
            case <-time.After(1 * time.Second):
                timeoutCount++
                slog.Warn("Force cleanup timeout", "userID", userID)
            }
        }
        
        delete(s.goroutines, userID)
    }
    
    return map[string]int{
        "stopped": stoppedCount,
        "timeout": timeoutCount,
        "total":   stoppedCount + timeoutCount,
    }
}