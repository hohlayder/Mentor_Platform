package service

import (
	"context"

	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/repository"
)

type UserProfileService struct {
	repo repository.UserProfileRepo
}

func NewUserService(repo repository.UserProfileRepo) *UserProfileService{
	return &UserProfileService{repo: repo}
}

func (s *UserProfileService) CreateUser(ctx context.Context, name string, surname string, email string) (string, error) {	
	return s.repo.CreateUser(ctx, name, surname, email)
}

func (s *UserProfileService) GetUserById(ctx context.Context, id string) (*domain.User, error) {
	return s.repo.GetUserByID(ctx, id)
}

func (s *UserProfileService) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	return s.repo.GetUserByEmail(ctx, email)
}

func (s *UserProfileService) GetCountUser(ctx context.Context) (int64, error) {
	return s.repo.GetCountUser(ctx)
}

func (s *UserProfileService) DeleteUser(ctx context.Context, id string) error {
	return s.repo.DeleteUser(ctx, id)
}

func (s *UserProfileService) GetProfileById(ctx context.Context, id string) (*domain.UserProfile, error){
	return s.repo.GetProfileByID(ctx, id)
}

func (s *UserProfileService) UpdateProfile(ctx context.Context, profile *domain.UpdateProfile) error {
	return s.repo.UpdateProfile(ctx, profile)
}

