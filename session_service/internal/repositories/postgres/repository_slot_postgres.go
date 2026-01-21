// postgres/slot_repository.go
package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

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
	query := `
		INSERT INTO slots (
			mentor_id, post_id, title, description, start_time, 
			duration_minutes, price, currency, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`

	var slotID string
	err := r.db.QueryRowContext(ctx, query,
		slot.MentorId,
		slot.PostId,           
		slot.Title,
		slot.Description,
		slot.StartTime,
		slot.DurationMinutes,
		slot.Price,
		slot.Currency,
		slot.Status,
	).Scan(&slotID)

	if err != nil {
		if strings.Contains(err.Error(), "no_overlapping_slots") {
			return "", fmt.Errorf("overlapping time slot")
		}
		if strings.Contains(err.Error(), "check constraint") {
			return "", fmt.Errorf("invalid slot status")
		}
		return "", fmt.Errorf("failed to create slot: %w", err)
	}

	return slotID, nil
}

func (r *SlotRepository) GetSlot(ctx context.Context, slotId string) (*domain.Slot, error) {
	query := `
		SELECT 
			id, mentor_id, post_id, status, title, description, 
			start_time, duration_minutes, price, currency,
			created_at, updated_at
		FROM slots 
		WHERE id = $1
	`

	var slot domain.Slot
	err := r.db.GetContext(ctx, &slot, query, slotId)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("slot not found")
		}
		return nil, fmt.Errorf("failed to get slot: %w", err)
	}

	return &slot, nil
}

func (r *SlotRepository) UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error {
	updates := []string{}
	args := []interface{}{}
	argIdx := 1

	if slot.PostId != nil {
		updates = append(updates, fmt.Sprintf("post_id = $%d", argIdx))
		args = append(args, *slot.PostId)
		argIdx++
	}
	
	if slot.Title != nil {
		updates = append(updates, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *slot.Title)
		argIdx++
	}
	if slot.Description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *slot.Description)
		argIdx++
	}
	if slot.StartTime != nil {
		updates = append(updates, fmt.Sprintf("start_time = $%d", argIdx))
		args = append(args, *slot.StartTime)
		argIdx++
	}
	if slot.DurationMinutes != nil {
		updates = append(updates, fmt.Sprintf("duration_minutes = $%d", argIdx))
		args = append(args, *slot.DurationMinutes)
		argIdx++
	}
	if slot.Price != nil {
		updates = append(updates, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *slot.Price)
		argIdx++
	}
	if slot.Currency != nil {
		updates = append(updates, fmt.Sprintf("currency = $%d", argIdx))
		args = append(args, *slot.Currency)
		argIdx++
	}
	if slot.Status != nil {
		updates = append(updates, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *slot.Status)
		argIdx++
	}

	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, slot.SlotId)
	query := fmt.Sprintf("UPDATE slots SET %s WHERE id = $%d",
		strings.Join(updates, ", "), argIdx)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		if strings.Contains(err.Error(), "no_overlapping_slots") {
			return fmt.Errorf("overlapping time slot")
		}
		return fmt.Errorf("failed to update slot: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("slot not found")
	}

	return nil
}

func (r *SlotRepository) DeleteSlot(ctx context.Context, slotId string) error {
	query := `DELETE FROM slots WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, slotId)
	if err != nil {
		return fmt.Errorf("failed to delete slot: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("slot not found")
	}

	return nil
}

func (r *SlotRepository) CheckSlotExists(ctx context.Context, slotId string) (bool, error) {
	var exists bool
	
	query := `SELECT EXISTS(SELECT 1 FROM slots WHERE id = $1)`
	
	err := r.db.GetContext(ctx, &exists, query, slotId)
	if err != nil {
		return false, fmt.Errorf("failed to check slot exists: %w", err)
	}
	
	return exists, nil
}

func (r *SlotRepository) UpdateSlotStatus(ctx context.Context, slotID string, status string) error {
    query := `
        UPDATE slots 
        SET status = $1, 
            updated_at = NOW()
        WHERE id = $2
    `
    
    result, err := r.db.ExecContext(ctx, query, status, slotID)
    if err != nil {
        if strings.Contains(err.Error(), "check constraint") {
            return fmt.Errorf("invalid status value")
        }
        return fmt.Errorf("failed to update slot status: %w", err)
    }
    
    rowsAffected, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }
    
    if rowsAffected == 0 {
        return fmt.Errorf("slot not found")
    }
    
    return nil
}

func (r *SlotRepository) GetSessionBySlotID(ctx context.Context, slotID string) (*domain.Session, error) {
	query := `
		SELECT id, slot_id, student_id, payment_status, rating, review, created_at, updated_at
		FROM sessions
		WHERE slot_id = $1
	`
	
	var session domain.Session
	err := r.db.QueryRowContext(ctx, query, slotID).Scan(
		&session.Id,
		&session.SlotId,
		&session.StudentId,
		&session.PaymentStatus,
		&session.Rating,
		&session.Review,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found for slot %s", slotID)
		}
		return nil, fmt.Errorf("failed to get session by slot id: %w", err)
	}
	
	return &session, nil
}

func (r *SlotRepository) GetSlotsByMentor(ctx context.Context, mentorID string) ([]domain.Slot, error) {
    query := `
        SELECT 
            id, mentor_id, post_id, status, title, description, 
            start_time, duration_minutes, price, currency,
            created_at, updated_at
        FROM slots 
        WHERE mentor_id = $1
        ORDER BY start_time ASC
    `

    var slots []domain.Slot
    err := r.db.SelectContext(ctx, &slots, query, mentorID)
    if err != nil {
        return nil, fmt.Errorf("failed to get slots by mentor: %w", err)
    }

    return slots, nil
}

func (r *SlotRepository) GetSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error) {
    query := `
        SELECT 
            id, mentor_id, post_id, status, title, description, 
            start_time, duration_minutes, price, currency,
            created_at, updated_at
        FROM slots 
        WHERE post_id = $1
        ORDER BY start_time ASC
    `

    var slots []domain.Slot
    err := r.db.SelectContext(ctx, &slots, query, postID)
    if err != nil {
        return nil, fmt.Errorf("failed to get slots by post: %w", err)
    }

    return slots, nil
}

func (r *SlotRepository) GetAvailableSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error) {
    query := `
        SELECT 
            id, mentor_id, post_id, status, title, description, 
            start_time, duration_minutes, price, currency,
            created_at, updated_at
        FROM slots 
        WHERE post_id = $1 AND status = 'available'
        ORDER BY start_time ASC
    `

    var slots []domain.Slot
    err := r.db.SelectContext(ctx, &slots, query, postID)
    if err != nil {
        return nil, fmt.Errorf("failed to get available slots by post: %w", err)
    }

    return slots, nil
}

func (r *SlotRepository) CloseExpiredSlots(ctx context.Context) (int64, error) {
    query := `
        UPDATE slots
        SET status = 'closed',
            updated_at = NOW()
        WHERE status IN ('available', 'booked')
          AND (start_time + (duration_minutes || ' minutes')::interval) <= NOW()
    `

    result, err := r.db.ExecContext(ctx, query)
    if err != nil {
        return 0, fmt.Errorf("failed to close expired slots: %w", err)
    }

    rowsAffected, err := result.RowsAffected()
    if err != nil {
        return 0, fmt.Errorf("failed to get rows affected: %w", err)
    }

    return rowsAffected, nil
}
