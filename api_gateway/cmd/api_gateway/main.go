package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/hohlayder/Mentor_Platform/api_gateway/docs"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/client"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/handlers"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/handlers/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/infrastructure/redis"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/infrastructure/repositories"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/service"
)

// @title Mentor Platform API
// @version 1.0
// @description API Gateway для Mentor Platform
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Введите: Bearer {jwt_token}
func main() {
	client, err := client.NewClient()
	if err != nil {
		log.Fatal("failed to connect to services ", err)
	}

	clientRepo := repositories.NewInMemoryClientRepository()
	redisCache := redis.NewClient(os.Getenv("REDIS_URL"), os.Getenv("REDIS_PASSWORD"), 0)
	messageRedisBroker := redis.NewRedisBroker(os.Getenv("REDIS_URL"), os.Getenv("REDIS_PASSWORD"), 1)
	messageService := service.NewMessageService(clientRepo, messageRedisBroker, *client.Chat, redisCache)
	webSocketService := service.NewWebSocketService(clientRepo, messageService)
	webSocketHandler := websocket.NewWebSocketHandler(webSocketService, messageService)
	authService := service.NewAuthService(client.Auth)
	authHandler := handlers.NewAuthHandler(authService)
	userService := service.NewUserService(client.User)
	userHandler := handlers.NewUserHandler(userService)
	chatService := service.NewChatService(client.Chat)
	chatHandler := handlers.NewChatHandler(chatService)
	handler := handlers.NewHandler(*webSocketHandler, *userHandler, *authHandler, *chatHandler)
	router := handlers.InitRoutes(*handler)

	

	srv := domain.NewServer(router)

	go func() {
		log.Printf("Server starting on :%s", "8080")
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	if err := srv.Shutdown(); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	redisCache.Close()
	messageRedisBroker.Close()
}