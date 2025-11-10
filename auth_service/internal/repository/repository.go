package repository

import (
	"context"
	"time"

	"github.com/hohlayder/Mentor_Platform/auth_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/repository/postgres"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	AuthRepo AuthRepository
	TokenRepo TokenRepository
}

func NewRepository(db *sqlx.DB) *Repository{
	return &Repository{
		AuthRepo: postgres.NewAuthRepositoryPostgres(db),
		TokenRepo: postgres.NewRepositoryTokenPostgres(db),
	}
}

type AuthRepository interface {
	Register(ctx context.Context, id string, hashPassword string) error
	GetCredentialByUserId(ctx context.Context, userId string) (*domain.Credential, error)
}

type TokenRepository interface {
	CreateRefreshToken(ctx context.Context, userId string, hashRefreshToken string, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, hashToken string) (string, error)
	RevokedToken(ctx context.Context, hashToken string) error
	DeleteRefreshToken(ctx context.Context, hashToken string) error
}