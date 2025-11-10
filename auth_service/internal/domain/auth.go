package domain

import (
	"database/sql"
	"time"
)

type Credential struct {
	Id           string    `db:"id"`
	UserId       string    `db:"user_id"`
	HashPassword string    `db:"hash_password"`
	LastLoginAt  sql.NullTime `db:"last_login_at"`
	CreatedAt    time.Time `db:"created_at"`
}

type RefreshToken struct {
	Id        string    `db:"id"`
	UserId    string    `db:"user_id"`
	TokenHash string    `db:"token_hash"`
	ExpiresAt string    `db:"expires_at"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}