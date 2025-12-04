package services

import (
	"context"
	"fmt"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
)

type SessionRepository interface {
	CreateSession(ctx context.Context, session *domain.Session) (string, error)
	GetSession(ctx context.Context, sessionId string) (*domain.Session, error)
	UpdateSession(ctx context.Context, session *domain.SessionUpdate) error
	DeleteSession(ctx context.Context, sessionId string) error
}

type SessionService struct {
	repo SessionRepository
}

func NewSessionService(repo SessionRepository) *SessionService{
	return &SessionService{repo: repo}
}

func (s *SessionService) CreateSession(ctx context.Context, session *domain.Session) (string, error) {
	return s.repo.CreateSession(ctx, session)
}

func (s *SessionService) GetSession(ctx context.Context, sessionId string) (*domain.Session, error) {
	return s.repo.GetSession(ctx, sessionId)
}

func (s *SessionService) UpdateSession(ctx context.Context, session *domain.SessionUpdate) error {
	if session.PaymentStatus == nil && session.Rating == nil && session.Review == nil && session.StudentId == nil {
		return fmt.Errorf("all field for update is empty")
	}
	
	return s.repo.UpdateSession(ctx, session)
}

func (s *SessionService) DeleteSession(ctx context.Context, sessionId string) error {
	return s.repo.DeleteSession(ctx, sessionId)
}