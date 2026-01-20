package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"github.com/jmoiron/sqlx"
)

type SessionRepository struct {
	db *sqlx.DB
}

func NewSessionRepository(db *sqlx.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) CreateSession(ctx context.Context, session *domain.Session) (string, error) {
	query := `INSERT INTO sessions(slot_id, student_id, payment_status, rating, review) 
				VALUES ($1, $2, $3, $4, $5) RETURNING id`

	var slotId string

	row := r.db.QueryRowContext(ctx, query, session.SlotId, session.StudentId, session.PaymentStatus, 
							toNullInt32(session.Rating), toNullString(session.Review))
	if err := row.Scan(&slotId); err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	return slotId, nil
}

func (r *SessionRepository) GetSession(ctx context.Context, sessionId string) (*domain.Session, error) {
	query := `SELECT id, slot_id, student_id, payment_status, rating, review, created_at, updated_at 
	FROM sessions WHERE id = $1`

	var session struct {
		Id             string    `db:"id"`
		SlotId         string    `db:"slot_id"`
		StudentId      string    `db:"student_id"`
		PaymentStatus  string    `db:"payment_status"`
		Rating         *int32    `db:"rating"` 
		Review         *string   `db:"review"`
		CreatedAt      time.Time `db:"created_at"`
		UpdatedAt      time.Time `db:"updated_at"`
	}

	err := r.db.GetContext(ctx, &session, query, sessionId)
	if err != nil {
	return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &domain.Session{
		Id:             session.Id,
		SlotId:         session.SlotId,
		StudentId:      session.StudentId,
		PaymentStatus:  session.PaymentStatus,
		Rating:         session.Rating,
		Review:         session.Review,
		CreatedAt:      session.CreatedAt,
		UpdatedAt:      session.UpdatedAt,
	}, nil
}

func (r *SessionRepository) UpdateSession(ctx context.Context, session *domain.SessionUpdate) error {
    if session.Id == "" {
        return fmt.Errorf("session id is required")
    }

    args := []interface{}{}
    setClauses := []string{}
    argCount := 0

    // Добавляем updated_at всегда
    setClauses = append(setClauses, "updated_at = NOW()")

    if session.StudentId != nil {
        argCount++
        args = append(args, *session.StudentId)
        setClauses = append(setClauses, fmt.Sprintf("student_id = $%d", argCount))
    }

    if session.PaymentStatus != nil {
        argCount++
        args = append(args, *session.PaymentStatus)
        setClauses = append(setClauses, fmt.Sprintf("payment_status = $%d", argCount))
    }

    if session.Rating != nil {
        argCount++
        args = append(args, *session.Rating)
        setClauses = append(setClauses, fmt.Sprintf("rating = $%d", argCount))
    }

    if session.Review != nil {
        argCount++
        args = append(args, *session.Review)
        setClauses = append(setClauses, fmt.Sprintf("review = $%d", argCount))
    }

    argCount++
    args = append(args, session.Id)
    
    query := fmt.Sprintf(
        "UPDATE sessions SET %s WHERE id = $%d",
        strings.Join(setClauses, ", "),
        argCount,
    )

    result, err := r.db.ExecContext(ctx, query, args...)
    if err != nil {
        return fmt.Errorf("failed to update session: %w", err)
    }

    rowsAffected, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }

    if rowsAffected == 0 {
        return fmt.Errorf("session not found")
    }

    return nil
}

func (r *SessionRepository) DeleteSession(ctx context.Context, sessionId string) error {
	query := `DELETE FROM sessions WHERE id=$1`

	result, err := r.db.ExecContext(ctx, query, sessionId)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	return nil
}

func (r *SessionRepository) ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.Session, error) {
	query := `
		SELECT 
			s.id as session_id,
			s.slot_id,
			s.student_id,
			s.payment_status,
			s.rating,
			s.review,
			s.created_at,
			s.updated_at
		FROM sessions s
		JOIN slots sl ON s.slot_id = sl.id
		WHERE sl.mentor_id = $1
		ORDER BY s.created_at DESC
	`

	var sessions []struct {
		SessionID     string         `db:"session_id"`
		SlotID        string         `db:"slot_id"`
		StudentID     string         `db:"student_id"`
		PaymentStatus string         `db:"payment_status"`
		Rating        sql.NullInt32  `db:"rating"`
		Review        sql.NullString `db:"review"`
		CreatedAt     time.Time      `db:"created_at"`
		UpdatedAt     time.Time      `db:"updated_at"`
	}

	err := r.db.SelectContext(ctx, &sessions, query, mentorID)
	if err != nil {
		return nil, fmt.Errorf("error listing sessions by mentor: %v", err)
	}

	result := make([]domain.Session, len(sessions))
	for i, s := range sessions {
		var ratingPtr *int32
		var reviewPtr *string
		
		if s.Rating.Valid {
			rating := s.Rating.Int32
			ratingPtr = &rating
		}
		
		if s.Review.Valid {
			review := s.Review.String
			reviewPtr = &review
		}
		result[i] = domain.Session{
			Id:     s.SessionID,
			SlotId:        s.SlotID,
			StudentId:     s.StudentID,
			PaymentStatus: s.PaymentStatus,
			Rating:        ratingPtr,
			Review:        reviewPtr,
			CreatedAt:     s.CreatedAt,
			UpdatedAt:     s.UpdatedAt,
		}
	}

	return result, nil
}

func (r *SessionRepository) ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.Session, error) {
	query := `
		SELECT 
			id as session_id,
			slot_id,
			student_id,
			payment_status,
			rating,
			review,
			created_at,
			updated_at
		FROM sessions
		WHERE student_id = $1
		ORDER BY created_at DESC
	`

	var sessions []struct {
		SessionID     string         `db:"session_id"`
		SlotID        string         `db:"slot_id"`
		StudentID     string         `db:"student_id"`
		PaymentStatus string         `db:"payment_status"`
		Rating        sql.NullInt32  `db:"rating"`
		Review        sql.NullString `db:"review"`
		CreatedAt     time.Time      `db:"created_at"`
		UpdatedAt     time.Time      `db:"updated_at"`
	}

	err := r.db.SelectContext(ctx, &sessions, query, studentID)
	if err != nil {
		return nil, fmt.Errorf("error listing sessions by student: %v", err)
	}

	result := make([]domain.Session, len(sessions))
	for i, s := range sessions {
		var ratingPtr *int32
		var reviewPtr *string
		
		if s.Rating.Valid {
			rating := s.Rating.Int32
			ratingPtr = &rating
		}
		
		if s.Review.Valid {
			review := s.Review.String
			reviewPtr = &review
		}

		result[i] = domain.Session{
			Id:     s.SessionID,
			SlotId:        s.SlotID,
			StudentId:     s.StudentID,
			PaymentStatus: s.PaymentStatus,
			Rating:        ratingPtr,
			Review:        reviewPtr,
			CreatedAt:     s.CreatedAt,
			UpdatedAt:     s.UpdatedAt,
		}
	}

	return result, nil
}

func (r *SessionRepository) UpdateSessionStatus(ctx context.Context, sessionID, status string) error {
	query := `
		UPDATE sessions s
		SET 
			payment_status = $1,
			updated_at = NOW()
		WHERE s.id = $2
	`

	result, err := r.db.ExecContext(ctx, query, status, sessionID)
	if err != nil {
		return fmt.Errorf("error updating session status: %v", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %v", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	return nil
}

func (r *SessionRepository) RateSession(ctx context.Context, sessionID string, rating int32, review string) error {
	query := `
		UPDATE sessions
		SET 
			rating = $1,
			review = $2,
			updated_at = NOW()
		WHERE id = $3
		AND payment_status = 'paid'
	`

	result, err := r.db.ExecContext(ctx, query, rating, review, sessionID)
	if err != nil {
		return fmt.Errorf("error rating session: %v", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %v", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("session not found or not paid")
	}

	return nil
}

func (r *SessionRepository) GetPaymentAmount(ctx context.Context, mentor_id string) (int64, error) {
	var paymentAmount int64
	query := `SELECT COALESCE(SUM(price), 0) FROM sessions se
				JOIN slots sl ON se.slot_id = sl.id
				WHERE mentor_id = $1 AND payment_status = 'paid'`

	err := r.db.GetContext(ctx, &paymentAmount, query, mentor_id)
	if err != nil {
		return 0, fmt.Errorf("failed to get payment amount: %w", err)
	}

	return paymentAmount, nil
}

func toNullInt32(value *int32) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

func toNullString(value *string) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

