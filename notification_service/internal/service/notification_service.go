package service

import (
	"context"
	"fmt"
	"log/slog"

	"time"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/repository/postgres"
)

type NotificationCRUDRepository interface {
	CreateNotification(ctx context.Context, notification *domain.Notification) error
	GetNotificationById(ctx context.Context, notificationId uuid.UUID) (*domain.Notification, error)
	DeleteNotification(ctx context.Context, notificationId uuid.UUID) error
	UpdateNotification(ctx context.Context, notificationUpdate *domain.NotificationUpdate) error
}

type RecipientRepository interface {
	GetPendingRecipientsWithNotifications(ctx context.Context, limit int) ([]*postgres.PendingRecipient, error)
	UpdateRecipientStatus(ctx context.Context, recipientID uuid.UUID, status string) error
	IncrementRecipientAttempts(ctx context.Context, recipientID uuid.UUID, errorMessage string) error
	MarkRecipientSent(ctx context.Context, recipientID uuid.UUID) error
	MarkRecipientFailed(ctx context.Context, recipientID uuid.UUID, errorMessage string) error
}

type NotificationRepository interface {
	NotificationCRUDRepository
	RecipientRepository
}

type NotificationService struct {
	repo NotificationRepository
	emailService EmailService
}

func NewNotificationService(repo NotificationRepository, emailService EmailService) *NotificationService {
	return &NotificationService{
		repo: repo,
		emailService: emailService,
	}
}

func (s *NotificationService) StartDeliveryWorker(ctx context.Context) {
    go func() {
        ticker := time.NewTicker(30 * time.Second)
        defer ticker.Stop()
        errChan := make(chan error, 1000)
		go s.monitorAndRestart(ctx, errChan)
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                errChan <- s.ProcessPendingNotifications(ctx, 100)
            }
        }
    }()
}

func (c *NotificationService) monitorAndRestart(ctx context.Context, errCh chan error) {
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errCh:
			slog.Info("delivery worker error (will continue running)", "error", err)
		}
	}
}


func (s *NotificationService) CreateNotification(ctx context.Context, notification *domain.Notification) error {
	/*
	if err := notification.Validate(); err != nil {
		return fmt.Errorf("invalid notification: %w", err)
	}
	*/

	return s.repo.CreateNotification(ctx, notification)
}

func (s *NotificationService) ProcessPendingNotifications(ctx context.Context, batchSize int) error {
	recipients, err := s.repo.GetPendingRecipientsWithNotifications(ctx, batchSize)
	if err != nil {
		return fmt.Errorf("failed to get pending recipients: %w", err)
	}

	for _, recipient := range recipients {
		if err := s.processRecipient(ctx, recipient); err != nil {
			slog.Error("Failed to process recipient", "recipient_id", recipient.RecipientID, "error", err)
		}
	}

	return nil
}

func (s *NotificationService) processRecipient(ctx context.Context, recipient *postgres.PendingRecipient) error {
	if err := s.emailService.SendNotification(ctx, recipient); err != nil {
		if incrErr := s.repo.IncrementRecipientAttempts(ctx, recipient.RecipientID, err.Error()); incrErr != nil {
			return fmt.Errorf("delivery failed and failed to update attempts: %v (original: %v)", incrErr, err)
		}

		if recipient.Attempts + 1 >= recipient.MaxAttempts {
			if markErr := s.repo.MarkRecipientFailed(ctx, recipient.RecipientID, "max attempts exceeded"); markErr != nil {
				return fmt.Errorf("delivery failed and failed to mark as failed: %v (original: %v)", markErr, err)
			}
		}

		return fmt.Errorf("failed to send notification: %w", err)	
	}

	return s.repo.MarkRecipientSent(ctx, recipient.RecipientID)
}