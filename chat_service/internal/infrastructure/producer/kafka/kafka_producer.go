package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/segmentio/kafka-go"
)


type KafkaNotificationProducer struct {
    writer    *kafka.Writer
    fromEmail string
}

type EmailNotificationRequest struct {
    RecipientEmail string
    RecipientUserID string
    Subject        string
    Body           string
    ChatID         string
    SenderID       string
}

func NewKafkaNotificationProducer(brokers []string, fromEmail string) *KafkaNotificationProducer {
    return &KafkaNotificationProducer{
        writer: &kafka.Writer{
            Addr:     kafka.TCP(brokers...),
            Topic:    domain.TopicNotifications,
            Balancer: &kafka.LeastBytes{},
        },
        fromEmail: fromEmail,
    }
}

func (p *KafkaNotificationProducer) SendEmailNotification(ctx context.Context, req domain.ChatMessagePayload) error {
    
    kafkaMsg := domain.KafkaMessage{
        ID:        uuid.New().String(),
        EventType: domain.EventTypeNewMessage,
        Data:      req,
        CreatedAt: time.Now(),
    }
    
    value, err := json.Marshal(kafkaMsg)
    if err != nil {
        return fmt.Errorf("failed to marshal notification: %w", err)
    }
    
    message := kafka.Message{
        Key:   []byte(req.ToUserID), 
        Value: value,
        Time:  time.Now(),
    }
    
    return p.writer.WriteMessages(ctx, message)
}

func (p *KafkaNotificationProducer) SendNewMessageNotification(
    ctx context.Context, 
    senderID, 
    recipientEmail,
	recipientId, 
    chatID, 
    messageContent string,
    messageId string,
) error {
    req := domain.ChatMessagePayload{
        FromUserID:   senderID,
        FromUserName: "",
        ToUserID:     recipientId,
        ToEmail:      recipientEmail,
        Message:      messageContent,
        ChatID:       chatID,
        MessageID:    messageId,
    }
    
    
    return p.SendEmailNotification(ctx, req)
}

func truncateMessage(message string, maxLength int) string {
    if len(message) <= maxLength {
        return message
    }
    return message[:maxLength] + "..."
}

func (p *KafkaNotificationProducer) Close() error {
    return p.writer.Close()
}