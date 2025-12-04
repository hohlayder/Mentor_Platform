package postgres

import (
	"context"
	"fmt"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"github.com/jmoiron/sqlx"
)

type SlotRepository struct {
	db *sqlx.DB
}

func NewSlotRepository(db *sqlx.DB) *SlotRepository {
	return &SlotRepository{db: db}
}

func (r *SlotRepository) CreateSlot(ctx context.Context, slot *domain.Slot) (string, error) {
	query := `INSERT INTO slots (mentor_id, title, description, start_time, duration_minutes, price, currency, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

	var slotID string
	err := r.db.QueryRowContext(ctx, query, slot.MentorId, slot.Title, slot.Description, slot.StartTime,
		slot.DurationMinutes, slot.Price, slot.Currency, slot.Status).Scan(&slotID)
	if err != nil {
		return "", fmt.Errorf("error creating slot: %v", err)
	}

	return slotID, nil
}

func (r *SlotRepository) GetSlot(ctx context.Context, slotId string) (*domain.Slot, error) {
	query := `SELECT id, mentor_id, title, description, start_time, duration_minutes, price, currency, status 
              FROM slots WHERE id = $1`

	var slot domain.Slot
	err := r.db.GetContext(ctx, &slot, query, slotId)

	if err != nil {
		return nil, fmt.Errorf("error getting slot: %v", err)
	}

	return &slot, nil
}

func (r *SlotRepository) UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error {
	args := []interface{}{}
	countArgs := 0
	query := `UPDATE slots SET `
	if slot.MentorId != nil {
		args = append(args, slot.MentorId)
		countArgs++
		query += fmt.Sprintf("mentor_id=$%d ", countArgs)
	}

	if slot.Title != nil {
		args = append(args, slot.Title)
		countArgs++
		query += fmt.Sprintf("title=$%d ", countArgs)
	}

	if slot.Description != nil {
		args = append(args, slot.Description)
		countArgs++
		query += fmt.Sprintf("description=$%d ", countArgs)
	}

	if slot.StartTime != nil {
		args = append(args, slot.StartTime)
		countArgs++
		query += fmt.Sprintf("start_time$%d ", countArgs)
	}

	if slot.DurationMinutes != nil {
		args = append(args, slot.DurationMinutes)
		countArgs++
		query += fmt.Sprintf("duration_minutes=$%d ", countArgs)
	}

	if slot.Price != nil {
		args = append(args, slot.Price)
		countArgs++
		query += fmt.Sprintf("price=$%d ", countArgs)
	}

	if slot.Currency != nil {
		args = append(args, slot.Currency)
		countArgs++
		query += fmt.Sprintf("currency=$%d ", countArgs)
	}

	if slot.Status != nil {
		args = append(args, slot.Status)
		countArgs++
		query += fmt.Sprintf("status=$%d ", countArgs)
	}

	query += fmt.Sprintf("WHERE id=$%d", countArgs+1)
	args = append(args, slot.SlotId)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("error updating slot: %v", err)
	}

	return nil
}

func (r *SlotRepository) DeleteSlot(ctx context.Context, slotId string) error {
	query := `DELETE FROM slots WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, slotId)

	if err != nil {
		return fmt.Errorf("error deleting slot: %v", err)
	}

	return nil
}

func (r *SlotRepository) CheckSlotExists(ctx context.Context, slotId string) (bool, error) {
	var exists bool
	
	query := `
		SELECT EXISTS(
			SELECT 1 FROM slots
			WHERE id = $1
		)`
	
	err := r.db.GetContext(ctx, &exists, query, slotId)
	if err != nil {
		return false, fmt.Errorf("failed to check chat exists: %w", err)
	}
	
	return exists, nil
}