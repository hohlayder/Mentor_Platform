package main


import (
	"context"
	"log"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	jwt "github.com/hohlayder/Mentor_Platform/auth_service/internal/auth/jwt"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/client"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/config"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/logger"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/middleware"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/repository"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/repository/postgres"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/service"

	handler "github.com/hohlayder/Mentor_Platform/auth_service/internal/handler/grpc"

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

	repository := repository.NewRepository(db)
	client, err := client.NewClient()
	if err != nil {
		log.Fatal("failed to create client: ", err)
	}

	defer func() {
		if err := client.Close(); err != nil {
			slog.Error("Error closing client", "err", err)
		}
		slog.Info("Client closed successfully")
	}()

	tokenManager := jwt.NewTokenManager([]byte(cfg.AccessSecret), cfg.AccessExpiry, cfg.RefreshExpiry, repository.TokenRepo)
	service := service.NewAuthService(repository.AuthRepo, repository.TokenRepo, client.User.Client, tokenManager)
	handler := handler.NewGRPCHandler(service)

	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.LoggingMiddleware(),
		),
		grpc.ConnectionTimeout(30*time.Second),
	)

	handler.RegisterServer(grpcServer)

	reflection.Register(grpcServer)

	go func() {
		lis, err := net.Listen("tcp", ":50052")
		if err != nil {
			log.Fatal("failed to listen port :50052", err)
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