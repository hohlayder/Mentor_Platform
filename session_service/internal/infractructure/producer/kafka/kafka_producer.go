package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"github.com/segmentio/kafka-go"
)

type BookingProducer struct {
	writer *kafka.Writer
}

func NewBookingProducer(brokers []string) *BookingProducer {
	return &BookingProducer{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(brokers...),
			Topic:    "book_event",  
			Balancer: &kafka.LeastBytes{},
			MaxAttempts:      5,
			WriteTimeout:     10 * time.Second,
			RequiredAcks:     kafka.RequireOne,
		},
	}
}

func (p *BookingProducer) SendSlotBookedEvent(
	ctx context.Context,
	slotID, mentorID, studentID string,
	mentorEmail, mentorName string,
	startTime time.Time,
) error {
	
	bookingEvent := domain.BookingEvent{
		EventID:     uuid.New().String(),
		EventType:   "slot_booked",
		SlotID:      slotID,
		MentorID:    mentorID,
		MentorEmail: mentorEmail,
		MentorName:  mentorName,
		StudentID:   studentID,
		StartTime:   startTime,
		CreatedAt:   time.Now(),
	}

	kafkaMsg := domain.KafkaBookingMessage{
		ID:        uuid.New().String(),
		EventType: "slot_booked",
		Data:      bookingEvent,
		CreatedAt: time.Now(),
	}

	value, err := json.Marshal(kafkaMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal booking event: %w", err)
	}

	message := kafka.Message{
		Key:   []byte(mentorID), 
		Value: value,
		Time:  time.Now(),
	}

	return p.writer.WriteMessages(ctx, message)
}

func (p *BookingProducer) Close() error {
	return p.writer.Close()
}