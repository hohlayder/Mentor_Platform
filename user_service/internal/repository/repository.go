package repository

import (
	"context"

	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"
)

type UserProfileRepo interface {
    ProfileRepo
    UserRepo
}

type ProfileRepo interface {
    GetProfileByID(ctx context.Context, id string) (*domain.UserProfile, error) // метод получает пользователя с информацией о нём как о менторе и студенте
    UpdateProfile(ctx context.Context, user *domain.UpdateProfile) error // обновляет  информацию о пользователе (если не существует информации как о менторе или студенте, то добавляет её)
}

type UserRepo interface {
    CreateUser(ctx context.Context, name string, surname string, email string) (string, error) //метод создаёт пользователя без информации о нём как о студенте или как о менторе
    GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
    GetUserByID(ctx context.Context, id string) (*domain.User, error)
    DeleteUser(ctx context.Context, id string) error 
}
