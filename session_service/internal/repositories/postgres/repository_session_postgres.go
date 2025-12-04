package postgres

import (
	"context"
	"fmt"

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

	row := r.db.QueryRowContext(ctx, query, session.SlotId, session.StudentId, session.PaymentStatus, session.Rating, session.Review)
	if err := row.Scan(&slotId); err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	return slotId, nil
}

func (r *SessionRepository) GetSession(ctx context.Context, sessionId string) (*domain.Session, error) {
	query := `SELECT * FROM sessions WHERE sessionId=$1`

	var session domain.Session
	err := r.db.GetContext(ctx, &session, query, sessionId)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

func (r *SessionRepository) UpdateSession(ctx context.Context, session *domain.SessionUpdate) error {
	args := []interface{}{}
	countArgs := 0
	query := `UPDATE sessions SET `

	if session.StudentId != nil {
		args = append(args, session.StudentId) 
		countArgs++
		query += fmt.Sprintf("student_id=$%d ", countArgs)
	}

	if session.PaymentStatus != nil {
		args = append(args, session.PaymentStatus)
		countArgs++
		query += fmt.Sprintf("payment_status=$%d ", countArgs)
	}

	if session.Rating != nil {
		args = append(args, session.Rating)
		countArgs++
		query += fmt.Sprintf("rating=$%d ", countArgs)
	}

	if session.Review != nil {
		args = append(args, session.Review)
		countArgs++
		query += fmt.Sprintf("review=$%d ", countArgs)
	}

	query += fmt.Sprintf("WHERE id=$%d", countArgs+1)
	args = append(args, session.Id)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	return nil
}

func (r *SessionRepository) DeleteSession(ctx context.Context, sessionId string) error {
	query := `DELETE FROM sessions WHERE id=$1`

	_, err := r.db.ExecContext(ctx, query, sessionId)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}