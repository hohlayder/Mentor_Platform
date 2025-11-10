package postgres

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
)

func NewMock() (*sqlx.DB, sqlmock.Sqlmock) {
	db, mock, _ := sqlmock.New()
	sqlxDB := sqlx.NewDb(db, "sqlmock")
	return sqlxDB, mock
}

func TestUserRepositoryPostgres_CreateUser_Success(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`INSERT INTO users`).
		WithArgs("test@example.com", "John", "Doe").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("user-123"))

	userID, err := repo.CreateUser(ctx, "John", "Doe", "test@example.com")

	assert.NoError(t, err)
	assert.Equal(t, "user-123", userID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_CreateUser_DBError(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`INSERT INTO users`).
		WithArgs("test@example.com", "John", "Doe").
		WillReturnError(errors.New("db error"))

	userID, err := repo.CreateUser(ctx, "John", "Doe", "test@example.com")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get user id")
	assert.Empty(t, userID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetUserByEmail_Success(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	expectedUser := &domain.User{
		Id:        "user-123",
		Email:     "test@example.com",
		Name:      "John",
		Surname:   "Doe",
		AvatarURL: nil,
		CreatedAt: time.Now(),
	}

	rows := sqlmock.NewRows([]string{"id", "email", "name", "surname", "avatar_url", "created_at"}).
		AddRow(expectedUser.Id, expectedUser.Email, expectedUser.Name, expectedUser.Surname, 
			expectedUser.AvatarURL, expectedUser.CreatedAt)

	mock.ExpectQuery(`SELECT \* FROM users WHERE email=\$1`).
		WithArgs("test@example.com").
		WillReturnRows(rows)

	user, err := repo.GetUserByEmail(ctx, "test@example.com")

	assert.NoError(t, err)
	assert.Equal(t, expectedUser, user)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetUserByEmail_NotFound(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`SELECT \* FROM users WHERE email=\$1`).
		WithArgs("test@example.com").
		WillReturnError(sql.ErrNoRows)

	user, err := repo.GetUserByEmail(ctx, "test@example.com")

	assert.Error(t, err)
	assert.Equal(t, "user not found", err.Error())
	assert.Nil(t, user)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetUserByEmail_DBError(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`SELECT \* FROM users WHERE email=\$1`).
		WithArgs("test@example.com").
		WillReturnError(errors.New("connection failed"))

	user, err := repo.GetUserByEmail(ctx, "test@example.com")

	assert.Error(t, err)
	assert.NotEqual(t, "user not found", err.Error())
	assert.Nil(t, user)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetUserByID_Success(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	expectedUser := &domain.User{
		Id:        "user-123",
		Email:     "test@example.com",
		Name:      "John",
		Surname:   "Doe",
		AvatarURL: nil,
		CreatedAt: time.Now(),
	}

	rows := sqlmock.NewRows([]string{"id", "email", "name", "surname", "avatar_url", "created_at"}).
		AddRow(expectedUser.Id, expectedUser.Email, expectedUser.Name, expectedUser.Surname, 
			expectedUser.AvatarURL, expectedUser.CreatedAt)

	mock.ExpectQuery(`SELECT \* FROM users WHERE id=\$1`).
		WithArgs("user-123").
		WillReturnRows(rows)

	user, err := repo.GetUserByID(ctx, "user-123")

	assert.NoError(t, err)
	assert.Equal(t, expectedUser, user)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_DeleteUser_Success(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectExec(`DELETE FROM users WHERE id=\$1`).
		WithArgs("user-123").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.DeleteUser(ctx, "user-123")

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_DeleteUser_Error(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectExec(`DELETE FROM users WHERE id=\$1`).
		WithArgs("user-123").
		WillReturnError(errors.New("delete error"))

	err := repo.DeleteUser(ctx, "user-123")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to delete user")
	assert.NoError(t, mock.ExpectationsWereMet())
}