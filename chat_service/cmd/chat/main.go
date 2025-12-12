package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hohlayder/Mentor_Platform/chat_service/internal/client"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/config"
	handler "github.com/hohlayder/Mentor_Platform/chat_service/internal/handler/grpc"
	redis_handler "github.com/hohlayder/Mentor_Platform/chat_service/internal/handler/redis"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/infrastructure/producer/kafka"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/logger"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/middleware"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/repository/postgres"
	redis_client "github.com/hohlayder/Mentor_Platform/chat_service/internal/repository/redis"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/service"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	configPath := config.GetConfigPath()

	cfg, err := config.InitConfig(configPath)
	if err != nil {
		log.Fatal("failed to init config: ", err)
	}

	logger.SetupJSONLogger()
	
	db, err := postgres.NewPostgresDatabase(*cfg)
	if err != nil {
		log.Fatal("failed to connect with database: ", err)
	}

	defer db.Close()

	repository := postgres.NewChatRepository(db)

	if err != nil {
		log.Fatal("failed to create client: ", err)
	}

	redisClient := redis_client.NewRedisClient(
        os.Getenv("REDIS_URL"),
		os.Getenv("REDIS_PASSWORD"),
		1,
    )
	//chat_messages
	client, err := client.NewClient()
	if err != nil {
		log.Fatal("failed to create grpc client: %w", err)
	}

	producer := kafka.NewKafkaNotificationProducer([]string{"kafka:9092"}, os.Getenv("GMAIL_EMAIL"))

	service := service.NewChatService(repository, client.User, producer)
	handler := handler.NewChatHandler(service)

	redisConsumer := redis_handler.NewConsumer(redisClient, service)
	go func() {
		redisConsumer.Start(context.Background())
		slog.Info("start redis consumer")
	}()

	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.LoggingMiddleware(),
		),
		grpc.ConnectionTimeout(cfg.ConnectionTime),
	)

	handler.RegisterServer(grpcServer)

	reflection.Register(grpcServer)

	go func() {
		port := os.Getenv("GRPC_PORT")
		if port == "" {
			port ="50053"
		}
		lis, err := net.Listen("tcp", ":" + port)
		if err != nil {
			log.Fatal(fmt.Sprintf("failed to listen port :%s", os.Getenv("GRPC_PORT")), err)
		}

		if err := grpcServer.Serve(lis); err != nil {
			log.Fatal("failed to serve grpc")
		}

	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		grpcServer.GracefulStop()
		cancel()
	}()

	<-ctx.Done()
}