package services

import (
	"context"
	"fmt"

	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
)

type SlotRepository interface {
	CreateSlot(ctx context.Context, slot *domain.Slot) (string, error)
	GetSlot(ctx context.Context, slotId string) (*domain.Slot, error)
	UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error
	DeleteSlot(ctx context.Context, slotId string) error
	CheckSlotExists(ctx context.Context, slotId string) (bool, error)
	UpdateSlotStatus(ctx context.Context, slotID string, status string) error
}

type SlotService struct {
	repo SlotRepository
}

func NewSlotService(repo SlotRepository) *SlotService {
	return &SlotService{repo: repo}
}

func (s *SlotService) CreateSlot(ctx context.Context, slot *domain.Slot) (string, error) {
	if slot.MentorId == "" {
		return "", fmt.Errorf("mentor_id is required")
	}
	if slot.Title == "" {
		return "", fmt.Errorf("title is required")
	}
	if slot.StartTime.IsZero() {
		return "", fmt.Errorf("start_time is required")
	}
	if slot.DurationMinutes <= 0 {
		return "", fmt.Errorf("duration_minutes must be positive")
	}
	if slot.Price < 0 {
		return "", fmt.Errorf("price cannot be negative")
	}
	if slot.Currency == "" {
		slot.Currency = "USD"
	}
	if slot.Status == "" {
		slot.Status = "available"
	}

	validStatuses := map[string]bool{
		"available": true,
		"booked":    true,
		"closed":    true,
	}
	if !validStatuses[slot.Status] {
		return "", fmt.Errorf("invalid status")
	}

	return s.repo.CreateSlot(ctx, slot)
}

func (s *SlotService) GetSlot(ctx context.Context, slotId string) (*domain.Slot, error) {
	if slotId == "" {
		return nil, fmt.Errorf("slot_id is required")
	}

	return s.repo.GetSlot(ctx, slotId)
}

func (s *SlotService) UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error {
	if slot.SlotId == "" {
		return fmt.Errorf("slot_id is required")
	}

	if slot.Status != nil {
		validStatuses := map[string]bool{
			"available": true,
			"booked":    true,
			"closed":    true,
		}
		if !validStatuses[*slot.Status] {
			return fmt.Errorf("invalid status")
		}
	}
	if slot.DurationMinutes != nil && *slot.DurationMinutes <= 0 {
		return fmt.Errorf("duration_minutes must be positive")
	}
	if slot.Price != nil && *slot.Price < 0 {
		return fmt.Errorf("price cannot be negative")
	}

	exists, err := s.repo.CheckSlotExists(ctx, slot.SlotId)
	if err != nil {
		return fmt.Errorf("failed to check slot existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("slot not found")
	}

	return s.repo.UpdateSlot(ctx, slot)
}

func (s *SlotService) DeleteSlot(ctx context.Context, slotId string) error {
	if slotId == "" {
		return fmt.Errorf("slot_id is required")
	}

	exists, err := s.repo.CheckSlotExists(ctx, slotId)
	if err != nil {
		return fmt.Errorf("failed to check slot existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("slot not found")
	}

	return s.repo.DeleteSlot(ctx, slotId)
}

func (s *SlotService) UpdateSlotStatus(ctx context.Context, slotID string, status string) error {
    if slotID == "" {
        return fmt.Errorf("slot_id is required")
    }

    validStatuses := map[string]bool{
        "available": true,
        "booked":    true,
        "closed":    true,
    }
    
    if !validStatuses[status] {
        return fmt.Errorf("invalid status: %s", status)
    }
    
    return s.repo.UpdateSlotStatus(ctx, slotID, status)
}