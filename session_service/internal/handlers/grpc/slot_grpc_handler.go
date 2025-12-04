package grpc

import (
	"context"
	"time"

	sessionv1 "github.com/Sergey-1214/contracts_mentors/session/v1"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type SlotService interface {
	CreateSlot(ctx context.Context, slot *domain.Slot) (string, error)
	GetSlot(ctx context.Context, slotId string) (*domain.Slot, error)
	UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error
	DeleteSlot(ctx context.Context, slotId string) error
}

type SlotHandler struct {
	service SlotService
}

func NewSlotHandler(service SlotService) *SlotHandler{
	return &SlotHandler{service: service}
}

func (h * SlotHandler) CreateSlot(ctx context.Context, req *sessionv1.CreateSlotRequest) (*sessionv1.CreateSlotResponse, error) {
	slot := &domain.Slot{
		MentorId: req.MentorId,
		Title: req.Title,
		Description: req.Description,
		StartTime: req.StartTime.AsTime(),
		DurationMinutes: req.DurationMinutes,
		Price: req.Price,
		Currency: req.Currency,
		Status: req.Status.String(),
	}

	slotId, err := h.service.CreateSlot(ctx, slot)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO CREATE SLOT")
	}

	return &sessionv1.CreateSlotResponse{
		SlotId: slotId,
		Success: true,
	}, nil
}

func (h *SlotHandler) GetSlot(ctx context.Context, req *sessionv1.GetSlotRequest) (*sessionv1.GetSlotResponse, error) {
	slot, err := h.service.GetSlot(ctx, req.SlotId)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO GET SLOT")
	}

	return &sessionv1.GetSlotResponse{
		SlotId: slot.SlotId,
		MentorId: slot.MentorId,
		Title: slot.Title,
		Description: slot.Description,
		StartTime: timestamppb.New(slot.StartTime),
		DurationMinutes: slot.DurationMinutes,
		Price: slot.Price,
		Currency: slot.Currency,
		//Status: sessionv1.SlotStatus(slot.Status),
	}, nil
}

//разобраться как работать со статусами (проблема enum) и с временем начала
func (h *SlotHandler) UpdateSlot(ctx context.Context, req *sessionv1.UpdateSlotRequest) (*sessionv1.UpdateSlotResponse, error) {
	updateField := &domain.SlotUpdate{
		SlotId: req.SlotId,
		Title: req.Title,
		Description: req.Description,
		DurationMinutes: req.DurationMinutes,
		Price: req.Price,
		Currency: req.Currency,
		
	}

	if req.StartTime != nil {
		startTime := timestampToTime(req.StartTime)
		updateField.StartTime = &startTime
	}

	err := h.service.UpdateSlot(ctx, updateField)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO UPDATE SLOT")
	}

	return &sessionv1.UpdateSlotResponse{
		Success: true,
	}, nil
}

func (h *SlotHandler) DeleteSlot(ctx context.Context, req *sessionv1.DeleteSlotRequest) (*sessionv1.DeleteSlotResponse, error) {
	err := h.service.DeleteSlot(ctx, req.SlotId)
	if err != nil {
		return nil, status.Error(codes.Internal, "FAILED TO DELETE SLOT")
	}

	return &sessionv1.DeleteSlotResponse{
		Success: true,
	}, nil 
}

func timestampToTime(t *timestamppb.Timestamp) time.Time {
	if t == nil {
		return time.Time{}
	}

	return t.AsTime()
}