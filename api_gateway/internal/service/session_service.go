package service

import (
	"context"
	"log/slog"

	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	sessionv1 "github.com/Sergey-1214/contracts_mentors/session/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type SessionClient interface {
	CreateSlot(ctx context.Context, in *sessionv1.CreateSlotRequest) (*sessionv1.CreateSlotResponse, error)
	GetSlot(ctx context.Context, in *sessionv1.GetSlotRequest) (*sessionv1.GetSlotResponse, error) 
	UpdateSlot(ctx context.Context, in *sessionv1.UpdateSlotRequest) (*sessionv1.UpdateSlotResponse, error) 
	DeleteSlot(ctx context.Context, in *sessionv1.DeleteSlotRequest) (*sessionv1.DeleteSlotResponse, error) 
	CreateSession(ctx context.Context, in *sessionv1.CreateSessionRequest) (*sessionv1.CreateSessionResponse, error) 
	GetSession(ctx context.Context, in *sessionv1.GetSessionRequest) (*sessionv1.GetSessionResponse, error) 
	UpdateSession(ctx context.Context, in *sessionv1.UpdateSessionRequest) (*sessionv1.UpdateSessionResponse, error)
	DeleteSession(ctx context.Context, in *sessionv1.DeleteSessionRequest) (*sessionv1.DeleteSessionResponse, error)
	ListSessionsByMentor(ctx context.Context, in *sessionv1.ListSessionsByMentorRequest) (*sessionv1.ListSessionsResponse, error) 
	ListSessionsByStudent(ctx context.Context, in *sessionv1.ListSessionsByStudentRequest) (*sessionv1.ListSessionsResponse, error)
	UpdateSlotStatus(ctx context.Context, in *sessionv1.UpdateSlotStatusRequest) (*sessionv1.UpdateSlotStatusResponse, error)
	RateSession(ctx context.Context, in *sessionv1.RateSessionRequest) (*sessionv1.RateSessionResponse, error) 
	GetSlotsByMentor(ctx context.Context, in *sessionv1.GetSlotsByMentorRequest) (*sessionv1.GetSlotsByMentorResponse, error)
}

type SessionService struct {
	client SessionClient
}

func NewSessionService(client SessionClient) *SessionService {
	return &SessionService{client: client}
}

func (s *SessionService) CreateSlot(ctx context.Context, req *domain.CreateSlotRequest) (string, error) {
	pbReq := &sessionv1.CreateSlotRequest{
		MentorId:        req.MentorID,
		Title:           req.Title,
		StartTime:       timestamppb.New(req.StartTime),
		DurationMinutes: req.DurationMinutes,
		Price:           req.Price,
		Currency:        req.Currency,
		Status:          convertToProtoSlotStatus(req.Status),
	}

	if req.Description != nil {
		pbReq.Description = *req.Description
	}

	resp, err := s.client.CreateSlot(ctx, pbReq)
	if err != nil {
		slog.Error("Failed to create slot via gRPC", "error", err)
		return "", err
	}

	return resp.SlotId, nil
}

func (s *SessionService) GetSlot(ctx context.Context, slotID string) (*domain.SlotResponse, error) {
	resp, err := s.client.GetSlot(ctx, &sessionv1.GetSlotRequest{SlotId: slotID})
	if err != nil {
		slog.Error("Failed to get slot via gRPC", "error", err)
		return nil, err
	}

	slotResp := &domain.SlotResponse{
		ID:              resp.SlotId,
		MentorID:        resp.MentorId,
		Title:           resp.Title,
		Description:     &resp.Description,
		StartTime:       resp.StartTime.AsTime(),
		DurationMinutes: resp.DurationMinutes,
		Price:           resp.Price,
		Currency:        resp.Currency,
		Status:          convertFromProtoSlotStatus(resp.Status),
	}

	return slotResp, nil
}

func (s *SessionService) UpdateSlot(ctx context.Context, slotID string, req *domain.UpdateSlotRequest) error {
	pbReq := &sessionv1.UpdateSlotRequest{
		SlotId: slotID,
	}

	if req.Title != nil {
		pbReq.Title = req.Title
	}
	if req.Description != nil {
		pbReq.Description = req.Description
	}
	if req.StartTime != nil {
		pbReq.StartTime = timestamppb.New(*req.StartTime)
	}
	if req.DurationMinutes != nil {
		pbReq.DurationMinutes = req.DurationMinutes
	}
	if req.Price != nil {
		pbReq.Price = req.Price
	}
	if req.Currency != nil {
		pbReq.Currency = req.Currency
	}
	if req.Status != nil {
		status := convertToProtoSlotStatus(*req.Status)
		pbReq.Status = &status
	}

	_, err := s.client.UpdateSlot(ctx, pbReq)
	if err != nil {
		slog.Error("Failed to update slot via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) UpdateSlotStatus(ctx context.Context, slotID, status string) error {
	_, err := s.client.UpdateSlotStatus(ctx, &sessionv1.UpdateSlotStatusRequest{
		SessionId: slotID,
		Status: convertToProtoSlotStatus(status),
	})
	if err != nil {
		slog.Error("Failed to update slot status via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) DeleteSlot(ctx context.Context, slotID string) error {
	_, err := s.client.DeleteSlot(ctx, &sessionv1.DeleteSlotRequest{SlotId: slotID})
	if err != nil {
		slog.Error("Failed to delete slot via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) CreateSession(ctx context.Context, req *domain.CreateSessionRequest) (string, error) {
	pbReq := &sessionv1.CreateSessionRequest{
		SlotId:        req.SlotID,
		StudentId:     req.StudentID,
		PaymentStatus: convertToProtoPaymentStatus(req.PaymentStatus),
	}

	resp, err := s.client.CreateSession(ctx, pbReq)
	if err != nil {
		slog.Error("Failed to create session via gRPC", "error", err)
		return "", err
	}

	return resp.SessionId, nil
}

func (s *SessionService) GetSession(ctx context.Context, sessionID string) (*domain.SessionResponse, error) {
	resp, err := s.client.GetSession(ctx, &sessionv1.GetSessionRequest{SessionId: sessionID})
	if err != nil {
		slog.Error("Failed to get session via gRPC", "error", err)
		return nil, err
	}

	session := &domain.SessionResponse{
		ID:            resp.SessionId,
		SlotID:        resp.SlotId,
		StudentID:     resp.StudentId,
		PaymentStatus: convertFromProtoPaymentStatus(resp.PaymentStatus),
		CreatedAt:     resp.CreatedAt.AsTime(),
		UpdatedAt:     resp.UpdatedAt.AsTime(),
	}

	if resp.Rating != 0 {
		session.Rating = &resp.Rating
	}
	if resp.Review != "" {
		session.Review = &resp.Review
	}

	return session, nil
}

func (s *SessionService) UpdateSession(ctx context.Context, sessionID string, req *domain.UpdateSessionRequest) error {
	pbReq := &sessionv1.UpdateSessionRequest{
		SessionId: sessionID,
	}

	if req.PaymentStatus != nil {
		status := convertToProtoPaymentStatus(*req.PaymentStatus)
		pbReq.PaymentStatus = &status
	}
	if req.Rating != nil {
		pbReq.Rating = req.Rating
	}
	if req.Review != nil {
		pbReq.Review = req.Review
	}

	_, err := s.client.UpdateSession(ctx, pbReq)
	if err != nil {
		slog.Error("Failed to update session via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) RateSession(ctx context.Context, sessionID string, req *domain.RateSessionRequest) error {
	grpcReq := sessionv1.RateSessionRequest{
		SessionId: sessionID,
		Rating:    req.Rating,
	}

	if req.Review != nil {
		grpcReq.Review = *req.Review
	}
	_, err := s.client.RateSession(ctx, &grpcReq)
	if err != nil {
		slog.Error("Failed to rate session via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.client.DeleteSession(ctx, &sessionv1.DeleteSessionRequest{SessionId: sessionID})
	if err != nil {
		slog.Error("Failed to delete session via gRPC", "error", err)
		return err
	}

	return nil
}

func (s *SessionService) ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.SessionResponse, error) {
	resp, err := s.client.ListSessionsByMentor(ctx, &sessionv1.ListSessionsByMentorRequest{
		MentorId: mentorID,
	})
	if err != nil {
		slog.Error("Failed to list sessions by mentor via gRPC", "error", err)
		return nil, err
	}

	sessions := make([]domain.SessionResponse, len(resp.Sessions))
	for i, session := range resp.Sessions {
		sessions[i] = domain.SessionResponse{
			ID:            session.SessionId,
			SlotID:        session.SlotId,
			StudentID:     session.StudentId,
			PaymentStatus: convertFromProtoPaymentStatus(session.PaymentStatus),
			CreatedAt:     session.CreatedAt.AsTime(),
			UpdatedAt:     session.UpdatedAt.AsTime(),
		}
		if session.Rating != 0 {
			sessions[i].Rating = &session.Rating
		}
		if session.Review != "" {
			sessions[i].Review = &session.Review
		}
	}

	return sessions, nil
}

func (s *SessionService) ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.SessionResponse, error) {
	resp, err := s.client.ListSessionsByStudent(ctx, &sessionv1.ListSessionsByStudentRequest{
		StudentId: studentID,
	})
	if err != nil {
		slog.Error("Failed to list sessions by student via gRPC", "error", err)
		return nil, err
	}

	sessions := make([]domain.SessionResponse, len(resp.Sessions))
	for i, session := range resp.Sessions {
		sessions[i] = domain.SessionResponse{
			ID:            session.SessionId,
			SlotID:        session.SlotId,
			StudentID:     session.StudentId,
			PaymentStatus: convertFromProtoPaymentStatus(session.PaymentStatus),
			CreatedAt:     session.CreatedAt.AsTime(),
			UpdatedAt:     session.UpdatedAt.AsTime(),
		}
		if session.Rating != 0 {
			sessions[i].Rating = &session.Rating
		}
		if session.Review != "" {
			sessions[i].Review = &session.Review
		}
	}

	return sessions, nil
}

func (s *SessionService) GetSlotsByMentor(ctx context.Context, mentorID string) ([]domain.SlotResponse, error) {
    resp, err := s.client.GetSlotsByMentor(ctx, &sessionv1.GetSlotsByMentorRequest{
        MentorId: mentorID,
    })
    if err != nil {
        slog.Error("Failed to get slots by mentor via gRPC", "error", err)
        return nil, err
    }

    slots := make([]domain.SlotResponse, len(resp.Slots))
    for i, slot := range resp.Slots {
        slotResp := domain.SlotResponse{
            ID:              slot.SlotId,
            MentorID:        slot.MentorId,
            Title:           slot.Title,
            StartTime:       slot.StartTime.AsTime(),
            DurationMinutes: slot.DurationMinutes,
            Price:           slot.Price,
            Currency:        slot.Currency,
            Status:          convertFromProtoSlotStatus(slot.Status),
        }
        
        if slot.Description != "" {
            slotResp.Description = &slot.Description
        }
        if slot.CreatedAt != nil {
            slotResp.CreatedAt = slot.CreatedAt.AsTime()
        }
        if slot.UpdatedAt != nil {
            slotResp.UpdatedAt = slot.UpdatedAt.AsTime()
        }
        
        slots[i] = slotResp
    }

    return slots, nil
}

func convertToProtoSlotStatus(status string) sessionv1.SlotStatus {
	switch status {
	case "available":
		return sessionv1.SlotStatus_SLOT_STATUS_AVAILABLE
	case "booked":
		return sessionv1.SlotStatus_SLOT_STATUS_BOOKED
	case "closed":
		return sessionv1.SlotStatus_SLOT_STATUS_CLOSED
	default:
		return sessionv1.SlotStatus_SLOT_STATUS_UNSPECIFIED
	}
}

func convertFromProtoSlotStatus(status sessionv1.SlotStatus) string {
	switch status {
	case sessionv1.SlotStatus_SLOT_STATUS_AVAILABLE:
		return "available"
	case sessionv1.SlotStatus_SLOT_STATUS_BOOKED:
		return "booked"
	case sessionv1.SlotStatus_SLOT_STATUS_CLOSED:
		return "closed"
	default:
		return ""
	}
}

func convertToProtoPaymentStatus(status string) sessionv1.PaymentStatus {
	switch status {
	case "pending":
		return sessionv1.PaymentStatus_PAYMENT_STATUS_PENDING
	case "paid":
		return sessionv1.PaymentStatus_PAYMENT_STATUS_COMPLETED
	case "failed":
		return sessionv1.PaymentStatus_PAYMENT_STATUS_FAILED
	default:
		return sessionv1.PaymentStatus_PAYMENT_STATUS_UNSPECIFIED
	}
}

func convertFromProtoPaymentStatus(status sessionv1.PaymentStatus) string {
	switch status {
	case sessionv1.PaymentStatus_PAYMENT_STATUS_PENDING:
		return "pending"
	case sessionv1.PaymentStatus_PAYMENT_STATUS_COMPLETED:
		return "paid"
	case sessionv1.PaymentStatus_PAYMENT_STATUS_FAILED:
		return "failed"
	default:
		return "pending"
	}
}