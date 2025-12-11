package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/service"
)

type NotificationHandler struct {
	notificationService *service.NotificationService
}

func NewNotificationHandlers(notificationService *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
	}
}

func (h *NotificationHandler) HandleChatMessage(ctx context.Context, payload []byte) error {
	var chatMsg domain.ChatMessagePayload
	if err := json.Unmarshal(payload, &chatMsg); err != nil {
		return fmt.Errorf("failed to unmarshal chat message: %w", err)
	}

	if chatMsg.ToEmail == "" {
		return fmt.Errorf("to_email is required")
	}
	if chatMsg.Message == "" {
		return fmt.Errorf("message is required")
	}

	notification := &domain.Notification{
		FromAddress: "noreply@mentorplatform.com",
		Subject:     fmt.Sprintf("New message from %s", chatMsg.FromUserName),
		Body:        fmt.Sprintf("You have a new message: %s", chatMsg.Message),
		Status:      domain.NotificationStatusPending,
		Type:        "email",
		Category:    stringPtr("chat"),
		EntityType:  stringPtr("message"),
		Recipients: []domain.Recipient{
			{
				ToAddress: &chatMsg.ToEmail,
				UserID:    &chatMsg.ToUserID,
				Status:    domain.NotificationStatusPending,
				MaxAttempts: 3,
			},
		},
	}

	if err := h.notificationService.CreateNotification(ctx, notification); err != nil {
		return fmt.Errorf("failed to create chat notification: %w", err)
	}

	log.Printf("Created chat notification for user %s", chatMsg.ToEmail)
	return nil
}

func (h *NotificationHandler) HandlePasswordReset(ctx context.Context, payload []byte) error {
	var pwdReset domain.PasswordResetPayload
	if err := json.Unmarshal(payload, &pwdReset); err != nil {
		return fmt.Errorf("failed to unmarshal password reset: %w", err)
	}

	if pwdReset.UserEmail == "" {
		return fmt.Errorf("user_email is required")
	}
	if pwdReset.Token == "" {
		return fmt.Errorf("token is required")
	}

	resetLink := fmt.Sprintf("https://mentorplatform.com/reset-password?token=%s", pwdReset.Token)
	
	notification := &domain.Notification{
		FromAddress: "noreply@mentorplatform.com",
		Subject:     "Password Reset Request",
		Body:        fmt.Sprintf("Click the link to reset your password: %s. This link expires at %s", 
			resetLink, pwdReset.ExpiresAt.Format("2006-01-02 15:04")),
		Status:      domain.NotificationStatusPending,
		Type:        "email",
		Category:    stringPtr("auth"),
		EntityType:  stringPtr("user"),
		Recipients: []domain.Recipient{
			{
				ToAddress: &pwdReset.UserEmail,
				UserID:    &pwdReset.UserID,
				Status:    domain.NotificationStatusPending,
				MaxAttempts: 3,
			},
		},
	}

	if err := h.notificationService.CreateNotification(ctx, notification); err != nil {
		return fmt.Errorf("failed to create password reset notification: %w", err)
	}

	log.Printf("Created password reset notification for user %s", pwdReset.UserEmail)
	return nil
}

func stringPtr(s string) *string {
	return &s
}