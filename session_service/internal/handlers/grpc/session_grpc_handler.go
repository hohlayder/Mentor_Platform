package grpc

import (
	"context"
	"errors"
	"strings"

	sessionv1 "github.com/Sergey-1214/contracts_mentors/session/v1"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SessionService interface {
	CreateSession(ctx context.Context, session *domain.Session) (string, error)
	GetSession(ctx context.Context, sessionId string) (*domain.Session, error)
	UpdateSession(ctx context.Context, session *domain.SessionUpdate) error
	DeleteSession(ctx context.Context, sessionId string) error
}

type SessionHandler struct {
	service SessionService
}

func NewSessionHandler(service SessionService) *SessionHandler {
	return &SessionHandler{service: service}
}

func (h *SessionHandler) CreateSession(ctx context.Context, req *sessionv1.CreateSessionRequest) (*sessionv1.CreateSessionResponse, error) {
	session := &domain.Session{
		SlotId: req.SlotId,
		StudentId: req.StudentId,
		PaymentStatus: req.PaymentStatus.String(),
	}
	sessionId, err := h.service.CreateSession(ctx, session)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO CREATE SESSION")
	}
	
	return &sessionv1.CreateSessionResponse{
		SessionId: sessionId,
	}, nil
}

func (h *SessionHandler) GetSession(ctx context.Context, req *sessionv1.GetSessionRequest) (*sessionv1.GetSessionResponse, error) {
	session, err := h.service.GetSession(ctx, req.SessionId)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO GET SESSION")
	}

	sessionStatus, err := convertPaymentStatus(session.PaymentStatus)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO GET SESSION")
	}

	return &sessionv1.GetSessionResponse{
		SessionId: session.Id,
		SlotId: session.SlotId,
		StudentId: session.StudentId,
		PaymentStatus: sessionStatus,
		Rating: session.Rating,
		Review: session.Review,
	}, nil
}

func (h *SessionHandler) UpdateSession(ctx context.Context, req *sessionv1.UpdateSessionRequest) (*sessionv1.UpdateSessionResponse, error) {
	updateSession := &domain.SessionUpdate{
		Id: req.SessionId,
		PaymentStatus: convertFromPaymentStatus(req.PaymentStatus),
		Rating: req.Rating,
		Review: req.Review,
	}

	err := h.service.UpdateSession(ctx, updateSession)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO UPDATE STATUS")
	}

	return &sessionv1.UpdateSessionResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) DelteSession(ctx context.Context, req *sessionv1.DeleteSessionRequest) (*sessionv1.DeleteSessionResponse, error) {
	err := h.service.DeleteSession(ctx, req.SessionId)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO DELETE SESSION")
	}

	return &sessionv1.DeleteSessionResponse{
		Success: true,
	}, nil
}

func convertPaymentStatus(statusStr string) (sessionv1.PaymentStatus, error) {
    normalized := strings.ToLower(strings.TrimSpace(statusStr))
	if normalized != "pending" && normalized != "paid" && normalized != "failed" {
		return sessionv1.PaymentStatus_PAYMENT_STATUS_UNSPECIFIED, errors.New("failed to1 ")
	}

    switch normalized {
    case "pending": 
        return sessionv1.PaymentStatus_PAYMENT_STATUS_PENDING, nil
    case "paid":
        return sessionv1.PaymentStatus_PAYMENT_STATUS_COMPLETED, nil
    case "failed":
        return sessionv1.PaymentStatus_PAYMENT_STATUS_FAILED, nil
	}

	return sessionv1.PaymentStatus_PAYMENT_STATUS_UNSPECIFIED, nil
}

func convertFromPaymentStatus(statusProto *sessionv1.PaymentStatus) *string {
	if statusProto == nil {
		return nil
	}
	statusStr := strings.TrimPrefix(statusProto.String(), "PAYMENT_STATUS_")
	return &statusStr
}