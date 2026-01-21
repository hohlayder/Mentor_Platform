package domain

import (
	"time"
)

type CreateSlotRequest struct {
	MentorID        string    `json:"mentor_id" binding:"required,uuid"`
	PostID          string    `json:"post_id" binding:"required,uuid"`
	Title           string    `json:"title" binding:"required,min=3,max=255"`
	Description     *string   `json:"description,omitempty" binding:"omitempty,max=1000"`
	StartTime       time.Time `json:"start_time" binding:"required"`
	DurationMinutes int32     `json:"duration_minutes" binding:"required,min=15,max=240"`
	Price           int64     `json:"price" binding:"min=0,max=1000000"`
	Currency        string    `json:"currency" binding:"omitempty,len=3"`
	Status          string    `json:"status" binding:"omitempty,slotstatus"`
}

type UpdateSlotRequest struct {
	PostID          *string    `json:"post_id,omitempty" binding:"omitempty,uuid"`
	Title           *string    `json:"title" binding:"omitempty,min=3,max=255"`
	Description     *string    `json:"description,omitempty" binding:"omitempty,max=1000"`
	StartTime       *time.Time `json:"start_time,omitempty"`
	DurationMinutes *int32     `json:"duration_minutes" binding:"omitempty,min=15,max=240"`
	Price           *int64     `json:"price" binding:"omitempty,min=0,max=1000000"`
	Currency        *string    `json:"currency" binding:"omitempty,len=3"`
	Status          *string    `json:"status" binding:"omitempty,slotstatus"`
}

type UpdateSlotStatusRequest struct {
	Status string `json:"status" binding:"required,slotstatus"`
}

type CreateSessionRequest struct {
	SlotID        string `json:"slot_id" binding:"required"`
	StudentID     string `json:"student_id" binding:"required"`
	PaymentStatus string `json:"payment_status" binding:"omitempty,paymentstatus"`
}

type UpdateSessionRequest struct {
	StudentID     *string `json:"student_id,omitempty" binding:"omitempty"`
	PaymentStatus *string `json:"payment_status,omitempty" binding:"omitempty,paymentstatus"`
	Rating        *int32  `json:"rating,omitempty" binding:"omitempty,min=1,max=5"`
	Review        *string `json:"review,omitempty" binding:"omitempty,max=1000"`
}

type RateSessionRequest struct {
	Rating int32   `json:"rating" binding:"required,min=1,max=5"`
	Review *string `json:"review,omitempty" binding:"omitempty,max=1000"`
}

// Ответы
type SlotResponse struct {
	ID              string    `json:"id"`
	MentorID        string    `json:"mentor_id"`
	PostID          string    `json:"post_id"`
	Title           string    `json:"title"`
	Description     *string   `json:"description,omitempty"`
	StartTime       time.Time `json:"start_time"`
	DurationMinutes int32     `json:"duration_minutes"`
	Price           int64     `json:"price"`
	Currency        string    `json:"currency"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at,omitempty"`
	UpdatedAt       time.Time `json:"updated_at,omitempty"`
}

type SessionResponse struct {
	ID            string    `json:"id"`
	SlotID        string    `json:"slot_id"`
	StudentID     string    `json:"student_id"`
	PaymentStatus string    `json:"payment_status"`
	Rating        *int32    `json:"rating,omitempty"`
	Review        *string   `json:"review,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ListSessionsResponse struct {
	Sessions []SessionResponse `json:"sessions"`
	Total    int64             `json:"total,omitempty"`
}

type ListSlotsResponse struct {
	Slots []SlotResponse `json:"slots"`
	Total int64          `json:"total,omitempty"`
}

type GetMentorPaymentAmountResponse struct {
	MentorID    string `json:"mentor_id"`
	TotalAmount int64  `json:"total_amount"`
}