package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hohlayder/Mentor_Platform/user_service/internal/config"
	handler "github.com/hohlayder/Mentor_Platform/user_service/internal/handlers/grpc"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/logger"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/middleware"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/repository/postgres"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/service"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	configPath := config.GetConfigPath()

	cfg, err := config.InitConfig(configPath)
	if err != nil {
		log.Fatal("failed to load config", err)
	}

	logger.SetupJSONLogger()

	db, err := postgres.NewPostgresRepository(*cfg)
	if err != nil {
		log.Fatal("failed to init database", err)
	}

	repository := postgres.NewUserRepositoryPostgres(db)
	service := service.NewUserService(repository)
	grpcHandler := handler.NewGRPCHandler(service)

	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.LoggingMiddleware(),
		),
		grpc.ConnectionTimeout(30*time.Second),
	)

	grpcHandler.Register(grpcServer)

	reflection.Register(grpcServer)

	go func() {
		lis, err := net.Listen("tcp", ":50051")
		if err != nil {
			log.Fatal("failed to listen port :50051", err)
		}

		if err := grpcServer.Serve(lis); err != nil {
			log.Fatal("failed to start grpc server", err)
		}
	}()
	
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<- stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
    	grpcServer.GracefulStop()
    	cancel()
	}()

	<-ctx.Done()
}