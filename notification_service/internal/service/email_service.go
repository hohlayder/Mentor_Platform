package service

import (
	"context"
	"fmt"
	"html/template"
	"strings"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/adapters/email/gmail"
	"github.com/hohlayder/Mentor_Platform/notification_service/internal/repository/postgres"
)

type EmailService struct {
	emailAdapter *gmail.EmailGmailAdapter
}

func NewEmailService(emailAdapter *gmail.EmailGmailAdapter) *EmailService {
	return &EmailService{
		emailAdapter: emailAdapter,
	}
}

func (s *EmailService) SendNotification(ctx context.Context, recipient *postgres.PendingRecipient) error {
	emailParams := gmail.EmailParams{
		To:      *recipient.ToAddress,
		Subject: recipient.Subject,
		HTML:    s.buildHTMLEmail(recipient),
		Text:    s.buildTextEmail(recipient),
	}

	return s.emailAdapter.SendEmail(ctx, emailParams)
}

func (s *EmailService) buildHTMLEmail(recipient *postgres.PendingRecipient) string {
	switch {
	case strings.Contains(recipient.Subject, "chat") || recipient.Category != nil && *recipient.Category == "chat":
		return s.buildChatEmailHTML(recipient)
	case strings.Contains(recipient.Subject, "password") || recipient.Category != nil && *recipient.Category == "auth":
		return s.buildPasswordResetEmailHTML(recipient)
	default:
		return s.buildDefaultEmailHTML(recipient)
	}
}

func (s *EmailService) buildChatEmailHTML(recipient *postgres.PendingRecipient) string {
	return fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
			.container { max-width: 600px; margin: 0 auto; padding: 20px; }
			.header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
			.content { background: #f9f9f9; padding: 20px; }
			.message { background: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 10px 0; }
			.footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<h1>💬 New Message</h1>
			</div>
			<div class="content">
				<p>Hello!</p>
				<div class="message">
					<strong>%s</strong>
				</div>
				<p><a href="" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Chat</a></p>
			</div>
			<div class="footer">
				<p>Mentor Platform - Connecting mentors and mentees</p>
			</div>
		</div>
	</body>
	</html>
	`, template.HTMLEscapeString(recipient.Body))
}

func (s *EmailService) buildPasswordResetEmailHTML(recipient *postgres.PendingRecipient) string {
	resetLink := extractResetLink(recipient.Body)
	
	return fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
			.container { max-width: 600px; margin: 0 auto; padding: 20px; }
			.header { background: #DC2626; color: white; padding: 20px; text-align: center; }
			.content { background: #f9f9f9; padding: 20px; }
			.button { background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
			.footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<h1>🔒 Password Reset</h1>
			</div>
			<div class="content">
				<p>You requested to reset your password. Click the button below to create a new password:</p>
				<p style="text-align: center;">
					<a href="%s" class="button">Reset Password</a>
				</p>
				<p>If you didn't request this, please ignore this email.</p>
				<p><small>This link will expire in 1 hour.</small></p>
			</div>
			<div class="footer">
				<p>Mentor Platform - Connecting mentors and mentees</p>
			</div>
		</div>
	</body>
	</html>
	`, resetLink)
}

func (s *EmailService) buildDefaultEmailHTML(recipient *postgres.PendingRecipient) string {
	return fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<body>
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2>%s</h2>
			<p>%s</p>
			<hr>
			<small>Mentor Platform</small>
		</div>
	</body>
	</html>
	`, template.HTMLEscapeString(recipient.Subject), template.HTMLEscapeString(recipient.Body))
}

func (s *EmailService) buildTextEmail(recipient *postgres.PendingRecipient) string {
	return fmt.Sprintf("%s\n\n%s\n\n--\nMentor Platform", recipient.Subject, recipient.Body)
}


func extractResetLink(body string) string {

	start := strings.Index(body, "https://")
	if start == -1 {
		return "https://mentorplatform.com/reset-password"
	}
	end := strings.Index(body[start:], " ")
	if end == -1 {
		return body[start:]
	}
	return body[start:start+end]
}