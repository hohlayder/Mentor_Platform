package gmail

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/smtp"
)

type EmailGmailAdapter struct {
	fromEmail string
	fromName  string
	password  string
}

func NewEmailGmailAdapter(email, password, fromName string) *EmailGmailAdapter {
	return &EmailGmailAdapter{
		fromEmail: email,
		fromName:  fromName,
		password:  password,
	}
}

type EmailParams struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

func (e *EmailGmailAdapter) SendEmail(ctx context.Context, params EmailParams) error {
	auth := smtp.PlainAuth("", e.fromEmail, e.password, "smtp.gmail.com")
	
	// Используем HTML версию, если есть, иначе текстовую
	body := params.HTML
	if body == "" {
		body = params.Text
	}

	// Формируем сообщение
	slog.Info("", "email", e.fromEmail, "password", e.password)
	msg := fmt.Sprintf("From: %s <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n%s\r\n", 
		e.fromName, e.fromEmail, params.To, params.Subject, body)

	err := smtp.SendMail("smtp.gmail.com:587", auth, e.fromEmail, []string{params.To}, []byte(msg))
	if err != nil {
		return fmt.Errorf("failed to send email via Gmail: %w", err)
	}

	log.Printf("Email sent successfully via Gmail to: %s", params.To)
	return nil
}

func (e *EmailGmailAdapter) SendBulkEmails(ctx context.Context, emails []EmailParams) error {
	for _, email := range emails {
		if err := e.SendEmail(ctx, email); err != nil {
			log.Printf("Failed to send email to %s: %v", email.To, err)
			continue
		}
	}
	return nil
}