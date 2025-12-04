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
}

type SlotService struct {
	repo SlotRepository
}

func NewSessionRepository(repo SlotRepository) *SlotService{
	return &SlotService{repo: repo}
}

func (s *SlotService) CreateSlot(ctx context.Context, slot *domain.Slot) (string, error) {
	return s.repo.CreateSlot(ctx, slot)
}

func (s *SlotService) GetSlot(ctx context.Context, slotId string) (*domain.Slot, error) {
	return s.repo.GetSlot(ctx, slotId)
}

func (s *SlotService) UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error {
	if slot.Currency == nil && slot.Description == nil && slot.DurationMinutes == nil && 
		slot.MentorId == nil && slot.Price == nil && slot.StartTime == nil &&
		slot.Status == nil && slot.Title == nil {
			return fmt.Errorf("nothing to update")
		}

	return s.repo.UpdateSlot(ctx, slot)
}

func (s *SlotService) DeleteSlot(ctx context.Context, slotId string) error {
	return s.repo.DeleteSlot(ctx, slotId)
}

