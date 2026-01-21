package grpc

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	sessionv1 "github.com/Sergey-1214/contracts_mentors/session/v1"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/services"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type SessionService interface {
	CreateSession(ctx context.Context, session *domain.Session) (string, error)
	GetSession(ctx context.Context, sessionId string) (*domain.Session, error)
	UpdateSession(ctx context.Context, session *domain.SessionUpdate) error
	DeleteSession(ctx context.Context, sessionId string) error
	ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.Session, error)
	ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.Session, error)
	RateSession(ctx context.Context, req domain.RateSessionRequest) error
	GetPaymentAmount(ctx context.Context, mentor_id string) (int64, error)
}

type SlotService interface {
	CreateSlot(ctx context.Context, slot *domain.Slot) (string, error)
	GetSlot(ctx context.Context, slotId string) (*domain.Slot, error)
	UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error
	DeleteSlot(ctx context.Context, slotId string) error
	UpdateSlotStatus(ctx context.Context, slotID, status string) error
	GetSlotsByMentor(ctx context.Context, mentorID string) ([]domain.Slot, error)
	GetSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error)          
	GetAvailableSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error)
}

type SessionHandler struct {
	sessionv1.UnimplementedMentorshipServiceServer
	sessionService SessionService
	slotService SlotService
}

func NewSessionHandler(sessionService SessionService, slotService SlotService) *SessionHandler {
	return &SessionHandler{
		sessionService: sessionService,
		slotService: slotService,
	}
}

func (h *SessionHandler) RegisterServer(server *grpc.Server) {
	sessionv1.RegisterMentorshipServiceServer(server, h)
}

func (h *SessionHandler) CreateSession(ctx context.Context, req *sessionv1.CreateSessionRequest) (*sessionv1.CreateSessionResponse, error) {
	if req.SlotId == "" {
        return nil, status.Error(codes.InvalidArgument, "slot_id is required")
    }
    if req.StudentId == "" {
        return nil, status.Error(codes.InvalidArgument, "student_id is required")
    }

	var paymentStatus string
	if req.PaymentStatus == sessionv1.PaymentStatus_PAYMENT_STATUS_UNSPECIFIED {
		paymentStatus = "pending"
	} else {
		if ptr := convertFromPaymentStatus(&req.PaymentStatus); ptr != nil {
			paymentStatus = *ptr
		} else {
			paymentStatus = "pending"
		}
	}

	session := &domain.Session{
		SlotId: req.SlotId,
		StudentId: req.StudentId,
		PaymentStatus: paymentStatus,
	}

	sessionId, err := h.sessionService.CreateSession(ctx, session)
	if err != nil {
		slog.Error("create session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, "failed to create session")
		}
	}
	
	return &sessionv1.CreateSessionResponse{
		SessionId: sessionId,
	}, nil
}

func (h *SessionHandler) GetSession(ctx context.Context, req *sessionv1.GetSessionRequest) (*sessionv1.GetSessionResponse, error) {
	session, err := h.sessionService.GetSession(ctx, req.SessionId)
	if err != nil {
		slog.Error("get session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidSessionID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, "failed to get session")
		}
	}

	sessionStatus := toProtoPaymentStatus(session.PaymentStatus)
	sessionResponse := &sessionv1.GetSessionResponse{
		SessionId: session.Id,
		SlotId: session.SlotId,
		StudentId: session.StudentId,
		PaymentStatus: sessionStatus,
		CreatedAt: timestamppb.New(session.CreatedAt),
		UpdatedAt: timestamppb.New(session.UpdatedAt),
	}

	if session.Rating != nil {
		sessionResponse.Rating = *session.Rating 
	}

	if session.Review != nil {
		sessionResponse.Review = *session.Review
	}

	return sessionResponse, nil
}

func (h *SessionHandler) UpdateSession(ctx context.Context, req *sessionv1.UpdateSessionRequest) (*sessionv1.UpdateSessionResponse, error) {
	if req.SessionId == "" {
        return nil, status.Error(codes.InvalidArgument, "session_id is required")
    }

	updateSession := &domain.SessionUpdate{
		Id: req.SessionId,
		Rating: req.Rating,
		Review: req.Review,
	}

	if req.PaymentStatus != sessionv1.PaymentStatus_PAYMENT_STATUS_UNSPECIFIED.Enum() {
        statusStr := convertFromPaymentStatus(req.PaymentStatus)
        updateSession.PaymentStatus = statusStr
    }

    err := h.sessionService.UpdateSession(ctx, updateSession)
	if err != nil {
		slog.Error("updated session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidSessionID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrInvalidStatus):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrInvalidRating):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, "failed to update session")
		}
	}

	return &sessionv1.UpdateSessionResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) DeleteSession(ctx context.Context, req *sessionv1.DeleteSessionRequest) (*sessionv1.DeleteSessionResponse, error) {
	if req.SessionId == "" {
		return nil, status.Error(codes.InvalidArgument, "session_id is required")
	}

	session, err := h.sessionService.GetSession(ctx, req.SessionId)
	if err != nil {
		slog.Error("get session before delete failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidSessionID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, "failed to get session")
		}
	}

	err = h.sessionService.DeleteSession(ctx, req.SessionId)
	if err != nil {
		slog.Error("session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidSessionID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, "failed to delete session")
		}
	}

	if err := h.slotService.UpdateSlotStatus(ctx, session.SlotId, "available"); err != nil {
		slog.Error("failed to update slot status after session delete", "error", err, "slot_id", session.SlotId)
		return nil, status.Error(codes.Internal, "failed to update slot status")
	}

	return &sessionv1.DeleteSessionResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) ListSessionsByMentor(ctx context.Context, req *sessionv1.ListSessionsByMentorRequest) (*sessionv1.ListSessionsResponse, error) {
	if req.MentorId == "" {
		return nil, status.Error(codes.InvalidArgument, "mentor_id is required")
	}

	sessions, err := h.sessionService.ListSessionsByMentor(ctx, req.MentorId)
	if err != nil {
		slog.Error("get list session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidMentorID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		default:
			return nil, status.Error(codes.Internal, "internal server error")
		}
	}

	return &sessionv1.ListSessionsResponse{
		Sessions: toProtoSessions(sessions),
	}, nil
}

func (h *SessionHandler) ListSessionsByStudent(ctx context.Context, req *sessionv1.ListSessionsByStudentRequest) (*sessionv1.ListSessionsResponse, error) {
	if req.StudentId == "" {
		return nil, status.Error(codes.InvalidArgument, "student_id is required")
	}

	sessions, err := h.sessionService.ListSessionsByStudent(ctx, req.StudentId)
	if err != nil {
		slog.Error("get list session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidStudentID):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		default:
			return nil, status.Error(codes.Internal, "internal server error")
		}
	}

	return &sessionv1.ListSessionsResponse{
		Sessions: toProtoSessions(sessions),
	}, nil
}

func (h *SessionHandler) RateSession(ctx context.Context,req *sessionv1.RateSessionRequest) (*sessionv1.RateSessionResponse, error) {
	if req.SessionId == "" {
		return nil, status.Error(codes.InvalidArgument, "session_id is required")
	}
	
	if req.Rating == 0 {
		return nil, status.Error(codes.InvalidArgument, "rating is required")
	}

	rateReq := domain.RateSessionRequest{
		SessionID: req.SessionId,
		Rating:    req.Rating,
		Review:    req.Review,
	}

	err := h.sessionService.RateSession(ctx, rateReq)
	if err != nil {
		slog.Error("rate session failed", "error", err)
		switch {
		case errors.Is(err, services.ErrInvalidSessionID):
			return nil, status.Error(codes.InvalidArgument, "invalid session id")
		case errors.Is(err, services.ErrInvalidRating):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, services.ErrSessionNotFound):
			return nil, status.Error(codes.NotFound, "session not found")
		case errors.Is(err, services.ErrSessionNotPaid):
			return nil, status.Error(codes.FailedPrecondition, "session must be paid to be rated")
		default:
			return nil, status.Error(codes.Internal, "failed to rate session")
		}
	}

	return &sessionv1.RateSessionResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) CreateSlot(ctx context.Context, req *sessionv1.CreateSlotRequest) (*sessionv1.CreateSlotResponse, error) {
	if req.MentorId == "" {
		return nil, status.Error(codes.InvalidArgument, "mentor_id is required")
	}
	if req.Title == "" {
		return nil, status.Error(codes.InvalidArgument, "title is required")
	}
	if req.StartTime == nil {
		return nil, status.Error(codes.InvalidArgument, "start_time is required")
	}
	if req.DurationMinutes <= 0 {
		return nil, status.Error(codes.InvalidArgument, "duration_minutes must be positive")
	}
	if req.Price < 0 {
		return nil, status.Error(codes.InvalidArgument, "price cannot be negative")
	}

	statusStr := slotStatusToString(req.Status)
	if statusStr == "" {
		return nil, status.Error(codes.InvalidArgument, "invalid status")
	}

	slot := &domain.Slot{
		MentorId:        req.MentorId,
		PostId:          stringToPtr(req.PostId), // Новое поле
		Title:           req.Title,
		Description:     stringToPtr(req.Description),
		StartTime:       req.StartTime.AsTime(),
		DurationMinutes: req.DurationMinutes,
		Price:           req.Price,
		Currency:        req.Currency,
		Status:          statusStr,
	}

	slotId, err := h.slotService.CreateSlot(ctx, slot)
	if err != nil {
		return nil, convertSlotError(err)
	}

	return &sessionv1.CreateSlotResponse{
		SlotId:  slotId,
		Success: true,
	}, nil
}

func (h *SessionHandler) GetSlot(ctx context.Context, req *sessionv1.GetSlotRequest) (*sessionv1.GetSlotResponse, error) {
	if req.GetSlotId() == "" {
		return nil, status.Error(codes.InvalidArgument, "slot_id is required")
	}

	slot, err := h.slotService.GetSlot(ctx, req.GetSlotId())
	if err != nil {
		return nil, convertSlotError(err)
	}

	return &sessionv1.GetSlotResponse{
		SlotId:          slot.SlotId,
		MentorId:        slot.MentorId,
		PostId:          stringFromPtr(slot.PostId), // Новое поле
		Title:           slot.Title,
		Description:     stringFromPtr(slot.Description),
		StartTime:       timestamppb.New(slot.StartTime),
		DurationMinutes: slot.DurationMinutes,
		Price:           slot.Price,
		Currency:        slot.Currency,
		Status:          convertToSlotStatus(slot.Status),
	}, nil
}

func (h *SessionHandler) UpdateSlot(ctx context.Context, req *sessionv1.UpdateSlotRequest) (*sessionv1.UpdateSlotResponse, error) {
	if req.SlotId == "" {
		return nil, status.Error(codes.InvalidArgument, "slot_id is required")
	}

	updateSlot := &domain.SlotUpdate{
		SlotId: req.SlotId,
	}

	if req.PostId != nil && *req.PostId != "" {
		updateSlot.PostId = req.PostId
	}
	
	if req.Title != nil && *req.Title != "" {
		updateSlot.Title = req.Title
	}
	if req.Description != nil {
		updateSlot.Description = req.Description
	}
	if req.StartTime != nil {
		startTime := req.StartTime.AsTime()
		updateSlot.StartTime = &startTime
	}
	if req.DurationMinutes != nil && *req.DurationMinutes > 0 {
		updateSlot.DurationMinutes = req.DurationMinutes
	}
	if req.Price != nil && *req.Price >= 0 {
		updateSlot.Price = req.Price
	}
	if req.Currency != nil && *req.Currency != "" {
		updateSlot.Currency = req.Currency
	}
	if req.Status != nil && *req.Status != sessionv1.SlotStatus_SLOT_STATUS_UNSPECIFIED {
		statusStr := slotStatusToString(*req.Status)
		if statusStr != "" {
			updateSlot.Status = &statusStr
		}
	}

	if updateSlot.PostId == nil && updateSlot.Title == nil && updateSlot.Description == nil && 
		updateSlot.StartTime == nil && updateSlot.DurationMinutes == nil && updateSlot.Price == nil && 
		updateSlot.Currency == nil && updateSlot.Status == nil {
		return nil, status.Error(codes.InvalidArgument, "at least one field must be provided for update")
	}

	err := h.slotService.UpdateSlot(ctx, updateSlot)
	if err != nil {
		return nil, convertSlotError(err)
	}

	return &sessionv1.UpdateSlotResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) DeleteSlot(ctx context.Context, req *sessionv1.DeleteSlotRequest) (*sessionv1.DeleteSlotResponse, error) {
	if req.GetSlotId() == "" {
		return nil, status.Error(codes.InvalidArgument, "slot_id is required")
	}

	err := h.slotService.DeleteSlot(ctx, req.GetSlotId())
	if err != nil {
		return nil, convertSlotError(err)
	}

	return &sessionv1.DeleteSlotResponse{
		Success: true,
	}, nil
}

func (h *SessionHandler) UpdateSlotStatus(ctx context.Context, req *sessionv1.UpdateSlotStatusRequest) (*sessionv1.UpdateSlotStatusResponse, error) {
    if req.SessionId == "" {
        return nil, status.Error(codes.InvalidArgument, "slot_id is required")
    }
    
    if req.Status == sessionv1.SlotStatus_SLOT_STATUS_UNSPECIFIED {
        return nil, status.Error(codes.InvalidArgument, "status is required")
    }

    statusStr := slotStatusToString(req.Status)
    if statusStr == "" {
        return nil, status.Error(codes.InvalidArgument, "invalid status")
    }
    
    err := h.slotService.UpdateSlotStatus(ctx, req.SessionId, statusStr)
    if err != nil {
        return nil, convertSlotError(err)
    }
    
    return &sessionv1.UpdateSlotStatusResponse{
        Success: true,
    }, nil
}

func (h *SessionHandler) GetSlotsByMentor(ctx context.Context, req *sessionv1.GetSlotsByMentorRequest) (*sessionv1.GetSlotsByMentorResponse, error) {
    if req.GetMentorId() == "" {
        return nil, status.Error(codes.InvalidArgument, "mentor_id is required")
    }

    slots, err := h.slotService.GetSlotsByMentor(ctx, req.GetMentorId())
    if err != nil {
        return nil, convertSlotError(err)
    }

    protoSlots := make([]*sessionv1.Slot, len(slots))
    for i, slot := range slots {
        protoSlots[i] = &sessionv1.Slot{
            SlotId:          slot.SlotId,
            MentorId:        slot.MentorId,
            PostId:          stringFromPtr(slot.PostId), 
            Title:           slot.Title,
            Description:     stringFromPtr(slot.Description),
            StartTime:       timestamppb.New(slot.StartTime),
            DurationMinutes: slot.DurationMinutes,
            Price:           slot.Price,
            Currency:        slot.Currency,
            Status:          convertToSlotStatus(slot.Status),
        }
    }

    return &sessionv1.GetSlotsByMentorResponse{
        Slots: protoSlots,
    }, nil
}

func (h *SessionHandler) GetMentorPaymentAmount(ctx context.Context, req *sessionv1.GetMentorPaymentAmountRequest) (*sessionv1.GetMentorPaymentAmountResponse, error) {
	mentorID := req.GetMentorId()
	if mentorID == "" {
		return nil, status.Error(codes.InvalidArgument, "mentor_id is required")
	}
	
	totalAmount, err := h.sessionService.GetPaymentAmount(ctx, mentorID)
	if err != nil {
		slog.Error("failed to get mentor payment amount",
			"mentor_id", mentorID,
			"error", err)
		return nil, status.Errorf(codes.Internal, "failed to get payment amount: %v", err)
	}
	return &sessionv1.GetMentorPaymentAmountResponse{
		MentorId:      mentorID,
		TotalAmount:   totalAmount,
	}, nil
}

func (h *SessionHandler) GetSlotsByPost(ctx context.Context, req *sessionv1.GetSlotsByPostRequest) (*sessionv1.GetSlotsByPostResponse, error) {
    if req.GetPostId() == "" {
        return nil, status.Error(codes.InvalidArgument, "post_id is required")
    }

    slots, err := h.slotService.GetSlotsByPost(ctx, req.GetPostId())
    if err != nil {
        return nil, convertSlotError(err)
    }

    protoSlots := make([]*sessionv1.Slot, len(slots))
    for i, slot := range slots {
        protoSlots[i] = &sessionv1.Slot{
            SlotId:          slot.SlotId,
            MentorId:        slot.MentorId,
            PostId:          stringFromPtr(slot.PostId),
            Title:           slot.Title,
            Description:     stringFromPtr(slot.Description),
            StartTime:       timestamppb.New(slot.StartTime),
            DurationMinutes: slot.DurationMinutes,
            Price:           slot.Price,
            Currency:        slot.Currency,
            Status:          convertToSlotStatus(slot.Status),
        }
    }

    return &sessionv1.GetSlotsByPostResponse{
        Slots: protoSlots,
    }, nil
}

func (h *SessionHandler) GetAvailableSlotsByPost(ctx context.Context, req *sessionv1.GetAvailableSlotsByPostRequest) (*sessionv1.GetAvailableSlotsByPostResponse, error) {
    if req.GetPostId() == "" {
        return nil, status.Error(codes.InvalidArgument, "post_id is required")
    }

    slots, err := h.slotService.GetAvailableSlotsByPost(ctx, req.GetPostId())
    if err != nil {
        return nil, convertSlotError(err)
    }

    protoSlots := make([]*sessionv1.Slot, len(slots))
    for i, slot := range slots {
        protoSlots[i] = &sessionv1.Slot{
            SlotId:          slot.SlotId,
            MentorId:        slot.MentorId,
            PostId:          stringFromPtr(slot.PostId),
            Title:           slot.Title,
            Description:     stringFromPtr(slot.Description),
            StartTime:       timestamppb.New(slot.StartTime),
            DurationMinutes: slot.DurationMinutes,
            Price:           slot.Price,
            Currency:        slot.Currency,
            Status:          convertToSlotStatus(slot.Status),
        }
    }

    return &sessionv1.GetAvailableSlotsByPostResponse{
        Slots: protoSlots,
    }, nil
}

func convertSlotError(err error) error {
	if err == nil {
		return nil
	}

	errMsg := err.Error()
	slog.Error("error on slot", "error", err)
	switch {
	case strings.Contains(errMsg, "is required"),
		strings.Contains(errMsg, "must be"),
		strings.Contains(errMsg, "cannot be"),
		strings.Contains(errMsg, "invalid"):
		return status.Error(codes.InvalidArgument, errMsg)
	
	case strings.Contains(errMsg, "not found"):
		return status.Error(codes.NotFound, errMsg)
	
	case strings.Contains(errMsg, "overlapping"):
		return status.Error(codes.FailedPrecondition, errMsg)
	
	default:
		return status.Error(codes.Internal, "internal server error")
	}
}

func slotStatusToString(status sessionv1.SlotStatus) string {
	switch status {
	case sessionv1.SlotStatus_SLOT_STATUS_AVAILABLE:
		return "available"
	case sessionv1.SlotStatus_SLOT_STATUS_BOOKED:
		return "booked"
	case sessionv1.SlotStatus_SLOT_STATUS_CLOSED:
		return "closed"
	case sessionv1.SlotStatus_SLOT_STATUS_UNSPECIFIED:
		return "available"
	default:
		return ""
	}
}

func convertToSlotStatus(status string) sessionv1.SlotStatus {
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

func stringToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func stringFromPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toProtoSessions(sessions []domain.Session) []*sessionv1.Session {
	protoSessions := make([]*sessionv1.Session, len(sessions))
	
	for i, s := range sessions {
		protoSessions[i] = &sessionv1.Session{
			SessionId:     s.Id,
			SlotId:        s.SlotId,
			StudentId:     s.StudentId,
			PaymentStatus: toProtoPaymentStatus(s.PaymentStatus),
			CreatedAt:     timestamppb.New(s.CreatedAt),
			UpdatedAt:     timestamppb.New(s.UpdatedAt),
		}

		if s.Rating != nil {
			protoSessions[i].Rating = *s.Rating
		}

		if s.Review != nil {
			protoSessions[i].Review = *s.Review
		}
	}
	return protoSessions
}

func toProtoPaymentStatus(status string) sessionv1.PaymentStatus {
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

func convertFromPaymentStatus(statusProto *sessionv1.PaymentStatus) *string {
	if statusProto == nil {
		return nil
	}
	if *statusProto == sessionv1.PaymentStatus_PAYMENT_STATUS_COMPLETED {
		statusStr := "paid"
		return &statusStr
	}

	statusStr := strings.TrimPrefix(statusProto.String(), "PAYMENT_STATUS_")
	statusStr = strings.ToLower(statusStr)
	return &statusStr
}
