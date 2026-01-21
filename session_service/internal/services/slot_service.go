// services/slot_service.go
package services

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/session_service/internal/domain"
)

// Добавляем новые интерфейсы в репозиторий
type SlotRepository interface {
	CreateSlot(ctx context.Context, slot *domain.Slot) (string, error)
	GetSlot(ctx context.Context, slotId string) (*domain.Slot, error)
	UpdateSlot(ctx context.Context, slot *domain.SlotUpdate) error
	DeleteSlot(ctx context.Context, slotId string) error
	CheckSlotExists(ctx context.Context, slotId string) (bool, error)
	UpdateSlotStatus(ctx context.Context, slotID string, status string) error
	GetSessionBySlotID(ctx context.Context, slotID string) (*domain.Session, error)
	GetSlotsByMentor(ctx context.Context, mentorID string) ([]domain.Slot, error)
	GetSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error)          
	GetAvailableSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error)
	CloseExpiredSlots(ctx context.Context) (int64, error)
}

type UserClient interface {
    CreateUser(ctx context.Context, in *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error)
    GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error)
    GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error)
    DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error)
    GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error)
    UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error)
    UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest) (*userv1.UploadAvatarResponse, error)
    DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest) (*userv1.DeleteAvatarResponse, error)
}

type KafkaProducer interface {
	SendSlotBookedEvent(ctx context.Context, slotID, mentorID, studentID, mentorEmail, 
						mentorName string, startTime time.Time) error
}

type SlotService struct {
	repo SlotRepository
	client UserClient
	producer KafkaProducer
}

func NewSlotService(repo SlotRepository, userClient UserClient, producer KafkaProducer) *SlotService {
	return &SlotService{
		repo: repo,
		client: userClient,
		producer: producer,
	}
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

func (s *SlotService) GetSlotsByMentor(ctx context.Context, mentorID string) ([]domain.Slot, error) {
    // Валидация
    if mentorID == "" {
        return nil, ErrInvalidMentorID
    }

    slots, err := s.repo.GetSlotsByMentor(ctx, mentorID)
    if err != nil {
        return nil, fmt.Errorf("failed to get slots: %w", err)
    }

    return slots, nil
}

// Новый метод: получение слотов по post_id
func (s *SlotService) GetSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error) {
    if postID == "" {
        return nil, fmt.Errorf("post_id is required")
    }

    slots, err := s.repo.GetSlotsByPost(ctx, postID)
    if err != nil {
        return nil, fmt.Errorf("failed to get slots by post: %w", err)
    }

    return slots, nil
}

// Новый метод: получение доступных слотов по post_id
func (s *SlotService) GetAvailableSlotsByPost(ctx context.Context, postID string) ([]domain.Slot, error) {
    if postID == "" {
        return nil, fmt.Errorf("post_id is required")
    }

    slots, err := s.repo.GetAvailableSlotsByPost(ctx, postID)
    if err != nil {
        return nil, fmt.Errorf("failed to get available slots by post: %w", err)
    }

    return slots, nil
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

	err := s.repo.UpdateSlotStatus(ctx, slotID, status)
	if err != nil {
		return fmt.Errorf("failed to update slot status: %w", err)
	}

	if status=="booked"{
		go func() {
			notificationCtx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
			defer cancel()

			err := s.SendNotification(notificationCtx, slotID)
			if err != nil {
				slog.Error("failed to send notification", "error", err)
			}
		}()	
	}
    
    return nil
}

func (s *SlotService) CloseExpiredSlots(ctx context.Context) (int64, error) {
    return s.repo.CloseExpiredSlots(ctx)
}

func (s *SlotService) SendNotification(ctx context.Context, slotId string) error {
	slot, err := s.repo.GetSlot(ctx, slotId)
	if err != nil {
		return fmt.Errorf("failed to get slot while send notification: %w", err)
	}

	mentor, err := s.client.GetUserById(ctx, toUserProtoRequest(slot.MentorId))
	if err != nil {
		return fmt.Errorf("failed to user while send notification: %w", err)
	}
	
	session, err := s.repo.GetSessionBySlotID(ctx, slotId)
	if err != nil {
		return fmt.Errorf("failed to get session by slot id: %w", err)
	}
	
	err = s.producer.SendSlotBookedEvent(ctx, slotId, slot.MentorId, session.StudentId, mentor.User.Email, mentor.User.FirstName, slot.StartTime)
	if err != nil {
		return fmt.Errorf("failed to send booked event")
	}
	return nil
}

func toUserProtoRequest(userId string) *userv1.GetUserByIdRequest {
	return &userv1.GetUserByIdRequest{
		UserId: userId,
	}
}

var (
	ErrInvalidPostID   = fmt.Errorf("invalid post id")
)
