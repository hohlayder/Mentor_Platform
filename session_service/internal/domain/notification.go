package domain

import (
	"time"
)

type BookingEvent struct {
	EventID     string    `json:"event_id"`
	EventType   string    `json:"event_type"`
	SlotID      string `json:"slot_id"`
	MentorID    string `json:"mentor_id"`
	MentorEmail string    `json:"mentor_email"`
	MentorName  string    `json:"mentor_name"`
	StudentID   string `json:"student_id"`
	StartTime   time.Time `json:"start_time"`
	CreatedAt   time.Time `json:"created_at"`
}

type KafkaBookingMessage struct {
	ID        string       `json:"id"`
	EventType string       `json:"event_type"`
	Data      BookingEvent `json:"data"`
	CreatedAt time.Time    `json:"created_at"`
}