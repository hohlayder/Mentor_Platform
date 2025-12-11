package kafka

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"strings"
	"time"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/handlers"
	"github.com/segmentio/kafka-go"
)

type NotificationKafkaConsumer struct {
	readers   map[string]*kafka.Reader
	handlers  *handlers.NotificationHandler
}

func NewNotificationKafkaConsumer(
	brokers []string,
	topics []string,
	groupID string,
	handler *handlers.NotificationHandler,
) *NotificationKafkaConsumer {
	readers := make(map[string]*kafka.Reader)
	
	for _, topic := range topics {
		reader := kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers,
			Topic:   topic,
			GroupID: groupID,
		})
		readers[topic] = reader
	}
	
	return &NotificationKafkaConsumer{
		readers: readers,
		handlers: handler,
	}
}

func (c *NotificationKafkaConsumer) Consume(ctx context.Context) {
	defer c.closeAllReaders()
	
	errCh := make(chan error, len(c.readers))
	
	for topic, reader := range c.readers {
		go func(topic string, reader *kafka.Reader) {
			if err := c.consumeTopic(ctx, reader, topic); err != nil {
				errCh <- fmt.Errorf("topic %s consumer failed: %w", topic, err)
			}
		}(topic, reader)
	}
	
	go c.monitorAndRestart(ctx, errCh)
	
	<-ctx.Done()
	log.Println("All consumers stopping gracefully...")
}

func (c *NotificationKafkaConsumer) monitorAndRestart(ctx context.Context, errCh chan error) {
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errCh:
			log.Printf("Consumer error (will continue running): %v", err)
		}
	}
}

func (c *NotificationKafkaConsumer) consumeTopic(ctx context.Context, reader *kafka.Reader, topic string) error {
	slog.Info("start consumer topic", "topic", topic)
	for {
		select {
		case <-ctx.Done():
			log.Printf("Topic %s consumer stopping...", topic)
			return nil
		default:
			kafkaCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			
			msg, err := reader.ReadMessage(kafkaCtx)
			if err != nil {
				cancel()
				if errors.Is(err, context.DeadlineExceeded) {
					continue
				}
				return fmt.Errorf("failed to read message from topic %s: %w", topic, err)
			}

			log.Printf("Received message from topic %s partition %d offset %d",
				msg.Topic, msg.Partition, msg.Offset)
			
			if err := c.routeMessage(kafkaCtx, msg, topic); err != nil {
				cancel()
				if IsDatabaseError(err) {
					log.Printf("Database error in topic %s, will retry: %v", topic, err)
					continue
				} else {
					log.Printf("Business logic error in topic %s, skipping message: %v", topic, err)
					if commitErr := reader.CommitMessages(kafkaCtx, msg); commitErr != nil {
						log.Printf("Failed to commit message in topic %s: %v", topic, commitErr)
					}
					continue
				}
			}

			if err := reader.CommitMessages(kafkaCtx, msg); err != nil {
				cancel()
				log.Printf("Error committing message in topic %s: %v", topic, err)
				continue
			}

			log.Printf("Successfully processed message from topic %s offset %d", topic, msg.Offset)
			cancel()
		}
	}
}

func (c *NotificationKafkaConsumer) routeMessage(ctx context.Context, msg kafka.Message, topic string) error {
	switch topic {
	case "chat_messages":
		return c.handlers.HandleChatMessage(ctx, msg.Value)
	case "password_resets":
		return c.handlers.HandlePasswordReset(ctx, msg.Value)
	default:
		return fmt.Errorf("no handler for topic: %s", topic)
	}
}

func (c *NotificationKafkaConsumer) closeAllReaders() {
	for _, reader := range c.readers {
		reader.Close()
	}
}

func IsDatabaseError(err error) bool {
	if err == nil {
		return false
	}

	errorStr := strings.ToLower(err.Error())


	databasePatterns := []string{
		"database", "sql", "connection", "timeout",
		"deadlock", "transaction", "constraint",
		"unique constraint", "foreign key", "duplicate", 
		"connection refused", "connection reset",
		"too many connections", "server has gone away",
	}

	for _, pattern := range databasePatterns {
		if strings.Contains(errorStr, pattern) {
			return true
		}
	}

	return false
}