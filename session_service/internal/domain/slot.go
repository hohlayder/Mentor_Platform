package domain

import (
	"time"
)

type Slot struct {
	SlotId          string    `db:"slot_id"`
	MentorId        string    `db:"mentor_id"`
	Title           string    `db:"title"`
	Description     string    `db:"description"`
	StartTime       time.Time `db:"start_time"`
	DurationMinutes int32     `db:"duration_minutes"`
	Price           int64     `db:"price"`
	Currency        string    `db:"currency"`
	Status          string    `db:"status"`
}

type Session struct {
	Id            string    `db:"id"`
	SlotId        string    `db:"slot_id"`
	StudentId     string    `db:"student_id"`
	PaymentStatus string    `db:"payment_status"`
	Rating        int32     `db:"rating"`
	Review        string    `db:"review"`
	CreatedAt     time.Time `db:"created_at"`
	UpdatedAt     time.Time `db:"updated_at"`
}

type SessionUpdate struct {
	Id            string    `db:"id"`
	StudentId     *string    `db:"student_id"`
	PaymentStatus *string    `db:"payment_status"`
	Rating        *int32     `db:"rating"`
	Review        *string    `db:"review"`
}

type SlotUpdate struct {
	SlotId          string     `db:"slot_id"`
	MentorId        *string    `db:"mentor_id"`
	Title           *string    `db:"title"`
	Description     *string    `db:"description"`
	StartTime       *time.Time `db:"start_time"`
	DurationMinutes *int32     `db:"duration_minutes"`
	Price           *int64     `db:"price"`
	Currency        *string    `db:"currency"`
	Status          *string    `db:"status"`
}
