package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
)

var (
	ErrInvalidMentorID  = errors.New("invalid mentor id")
	ErrInvalidStudentID = errors.New("invalid student id")
	ErrInvalidSessionID = errors.New("invalid session id")
	ErrInvalidStatus    = errors.New("invalid status")
	ErrInvalidRating    = errors.New("rating must be between 1 and 5")
	ErrSessionNotFound  = errors.New("session not found")
	ErrSessionNotPaid   = errors.New("session is not paid")
)

type SessionRepository interface {
	CreateSession(ctx context.Context, session *domain.Session) (string, error)
	GetSession(ctx context.Context, sessionId string) (*domain.Session, error)
	UpdateSession(ctx context.Context, session *domain.SessionUpdate) error
	DeleteSession(ctx context.Context, sessionId string) error
	ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.Session, error)
	ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.Session, error)
	RateSession(ctx context.Context, sessionID string, rating int32, review string) error
	GetPaymentAmount(ctx context.Context, mentor_id string) (int64, error)
}

type SessionService struct {
	repo SessionRepository
}

func NewSessionService(repo SessionRepository) *SessionService{
	return &SessionService{repo: repo}
}

func (s *SessionService) CreateSession(ctx context.Context, session *domain.Session) (string, error) {
	if session.SlotId == "" {
		return "", fmt.Errorf("slot_id is required")
	}
	if session.StudentId == "" {
		return "", fmt.Errorf("student_id is required")
	}

	return s.repo.CreateSession(ctx, session)
}

func (s *SessionService) GetSession(ctx context.Context, sessionId string) (*domain.Session, error) {
	if sessionId == "" {
		return nil, ErrInvalidSessionID
	}

	session, err := s.repo.GetSession(ctx, sessionId)
	if err != nil {
		if err.Error() == "session not found" {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	return session, nil
}

func (s *SessionService) UpdateSession(ctx context.Context, session *domain.SessionUpdate) error {
	if session.Id == "" {
		return ErrInvalidSessionID
	}

	if session.PaymentStatus == nil && session.Rating == nil && 
	   session.Review == nil && session.StudentId == nil {
		return fmt.Errorf("no fields provided for update")
	}

	if session.PaymentStatus != nil {
		validStatuses := map[string]bool{
			"pending": true,
			"paid":    true,
			"failed":  true,
		}
		if !validStatuses[*session.PaymentStatus] {
			return ErrInvalidStatus
		}
	}
	
	if session.Rating != nil {
		if *session.Rating < 1 || *session.Rating > 5 {
			return ErrInvalidRating
		}
	}
	
	return s.repo.UpdateSession(ctx, session)
}

func (s *SessionService) DeleteSession(ctx context.Context, sessionId string) error {
	if sessionId == "" {
		return ErrInvalidSessionID
	}

	err := s.repo.DeleteSession(ctx, sessionId)
	if err != nil && err.Error() == "session not found" {
		return ErrSessionNotFound
	}

	return err
}

func (s *SessionService) ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.Session, error) {
	if mentorID == "" {
		return nil, ErrInvalidMentorID
	}

	return s.repo.ListSessionsByMentor(ctx, mentorID)
}

func (s *SessionService) ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.Session, error) {
	if studentID == "" {
		return nil, ErrInvalidStudentID
	}

	return s.repo.ListSessionsByStudent(ctx, studentID)
}


func (s *SessionService) RateSession(ctx context.Context, req domain.RateSessionRequest) error {
	if req.SessionID == "" {
		return ErrInvalidSessionID
	}
	
	if req.Rating < 1 || req.Rating > 5 {
		return ErrInvalidRating
	}

	return s.repo.RateSession(ctx, req.SessionID, req.Rating, req.Review)
}

func (s *SessionService) GetPaymentAmount(ctx context.Context, mentor_id string) (int64, error) {
	if mentor_id == "" {
		return 0, ErrInvalidMentorID
	}

	return s.repo.GetPaymentAmount(ctx, mentor_id)
}