package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/hohlayder/Mentor_Platform/auth_service/internal/domain"
	"github.com/jmoiron/sqlx"
)

type AuthRepositoryPostgres struct {
	db *sqlx.DB
}

func NewAuthRepositoryPostgres(db *sqlx.DB) *AuthRepositoryPostgres {
	return &AuthRepositoryPostgres{db: db}
}

func (r *AuthRepositoryPostgres) Register(ctx context.Context, id string, hashPassword string) error {
	query := `INSERT INTO auth_credentials(user_id, hash_password) VALUES ($1, $2)`
	_, err := r.db.ExecContext(ctx, query, id, hashPassword)

	return err
}

func (r *AuthRepositoryPostgres) GetCredentialByUserId(ctx context.Context, userId string) (*domain.Credential, error){
	var credential domain.Credential
	query := `SELECT * FROM auth_credentials WHERE user_id=$1`
	err := r.db.GetContext(ctx, &credential, query, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("no rows")
		}

		return nil, err
	}

	return &credential, nil
}