package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/config"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/logger"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/middleware"

	handler "github.com/hohlayder/Mentor_Platform/session_service/internal/handlers/grpc"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/repositories/postgres"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/services"
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

	sessionRepository := postgres.NewSessionRepository(db)
	slotRepository := postgres.NewSlotRepository(db)

	sessionService := services.NewSessionService(sessionRepository)
	slotService := services.NewSlotService(slotRepository)

	handler := handler.NewSessionHandler(sessionService, slotService)

	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.LoggingMiddleware(),
		),
		grpc.ConnectionTimeout(30*time.Second),
	)

	handler.RegisterServer(grpcServer)

	reflection.Register(grpcServer)

	go func() {
		lis, err := net.Listen("tcp", ":50057")
		if err != nil {
			log.Fatal("failed to listen port :50057", err)
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