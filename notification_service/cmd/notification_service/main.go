package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/adapters/consumer/kafka"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/adapters/email/gmail"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/config"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/handlers"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/repository/postgres"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/service"
)

func main() {
	
	cfg, err := config.InitConfig(config.GetConfigPath())
	if err != nil {
		log.Fatal("failed to init config: ", err)
	}
	slog.Info("config","cfg", cfg)
	db, err := postgres.NewPostgresRepository(*cfg)
	if err != nil {
		log.Fatal("failed to connect to database: ", err)
	}

	defer db.Close()

	repo := postgres.NewNotifcationRepositoryPostgres(db)
	emailAdapter := gmail.NewEmailGmailAdapter(cfg.GmailConfig.Email, cfg.GmailConfig.Password, cfg.FromName)
	emailService := service.NewEmailService(emailAdapter)
	notificationService := service.NewNotificationService(repo, *emailService)
	notificationHandler := handlers.NewNotificationHandlers(notificationService)

	topics := []string{"chat_messages", "auth_events"}
	kafkaConsumer := kafka.NewNotificationKafkaConsumer([]string{"kafka:9092"}, topics, "notification-service-dev", notificationHandler)
	
	ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    var wg sync.WaitGroup

    wg.Add(1)
    go func() {
        defer wg.Done()
        kafkaConsumer.Consume(ctx)
    }()

    wg.Add(1)
    go func() {
        defer wg.Done()
        notificationService.StartDeliveryWorker(ctx)
    }()

    slog.Info("notification service started successfully", 
        "topics", topics,
        "version", "1.0.0")

    stop := make(chan os.Signal, 1)
    signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
    
    <-stop
    slog.Info("received shutdown signal")
    
    cancel()
    
    done := make(chan struct{})
    go func() {
        wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        slog.Info("all workers stopped gracefully")
    case <-time.After(30 * time.Second):
        slog.Warn("graceful shutdown timeout, forcing exit")
    }
}	