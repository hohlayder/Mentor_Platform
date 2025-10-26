package postgres

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"github.com/stretchr/testify/assert"
)

func TestUserRepositoryPostgres_GetProfileByID_FullProfile(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description",
		"student_user_id", "learning_goals", "preferred_learning_style",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience",
		"ls_id", "learning_skill_name", "learning_level",
	}).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			"user-123", "wallet123", 4.5, "Experienced mentor",
			"user-123", "Learn Go", "practice",
			"ts-1", "Go", "expert", 5,
			"ls-1", "Docker", "intermediate",
		).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			"user-123", "wallet123", 4.5, "Experienced mentor",
			"user-123", "Learn Go", "practice",
			nil, nil, nil, nil,
			"ls-2", "Kubernetes", "beginner",
		).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			"user-123", "wallet123", 4.5, "Experienced mentor",
			"user-123", "Learn Go", "practice",
			"ts-2", "Docker", "advanced", 3,
			nil, nil, nil,
		)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.Equal(t, "user-123", profile.User.Id)
	assert.Equal(t, "john@example.com", profile.User.Email)

	assert.NotNil(t, profile.Mentor)
	assert.Equal(t, "user-123", profile.Mentor.UserId)
	assert.Equal(t, "wallet123", *profile.Mentor.Withdrawal)
	assert.Equal(t, 4.5, *profile.Mentor.Rating)
	assert.Equal(t, "Experienced mentor", *profile.Mentor.Description)

	assert.NotNil(t, profile.Student)
	assert.Equal(t, "user-123", profile.Student.UserId)
	assert.Equal(t, "Learn Go", *profile.Student.LearningGoals)
	assert.Equal(t, "practice", *profile.Student.PreferredLearningStyle)

	assert.Len(t, profile.TeachingSkills, 2)
	assert.Len(t, profile.LearningSkills, 2)

	teachingSkillNames := []string{}
	for _, skill := range profile.TeachingSkills {
		teachingSkillNames = append(teachingSkillNames, skill.SkillName)
	}
	assert.Contains(t, teachingSkillNames, "Go")
	assert.Contains(t, teachingSkillNames, "Docker")

	learningSkillNames := []string{}
	for _, skill := range profile.LearningSkills {
		learningSkillNames = append(learningSkillNames, skill.SkillName)
	}
	assert.Contains(t, learningSkillNames, "Docker")
	assert.Contains(t, learningSkillNames, "Kubernetes")

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_NoMentorStudent(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description",
		"student_user_id", "learning_goals", "preferred_learning_style",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience",
		"ls_id", "learning_skill_name", "learning_level",
	}).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			nil, nil, nil, nil,
			nil, nil, nil,
			nil, nil, nil, nil,
			nil, nil, nil,
		)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.Equal(t, "user-123", profile.User.Id)
	assert.Nil(t, profile.Mentor)
	assert.Nil(t, profile.Student)
	assert.Empty(t, profile.TeachingSkills)
	assert.Empty(t, profile.LearningSkills)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_OnlyMentor(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description",
		"student_user_id", "learning_goals", "preferred_learning_style",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience",
		"ls_id", "learning_skill_name", "learning_level",
	}).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			"user-123", "wallet123", 4.5, "Mentor desc",
			nil, nil, nil,
			"ts-1", "Go", "expert", 5,
			nil, nil, nil,
		)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.NotNil(t, profile.Mentor)
	assert.Nil(t, profile.Student)
	assert.Len(t, profile.TeachingSkills, 1)
	assert.Empty(t, profile.LearningSkills)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_OnlyStudent(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description",
		"student_user_id", "learning_goals", "preferred_learning_style",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience",
		"ls_id", "learning_skill_name", "learning_level",
	}).
		AddRow(
			"user-123", "john@example.com", "John", "Doe", nil, time.Now(),
			nil, nil, nil, nil,
			"user-123", "Learn programming", "video",
			nil, nil, nil, nil,
			"ls-1", "Go", "beginner",
		)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.Nil(t, profile.Mentor)
	assert.NotNil(t, profile.Student)
	assert.Empty(t, profile.TeachingSkills)
	assert.Len(t, profile.LearningSkills, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_NotFound(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnError(sql.ErrNoRows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.Error(t, err)
	assert.Equal(t, "user not found", err.Error())
	assert.Nil(t, profile)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_EmptyResult(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description",
		"student_user_id", "learning_goals", "preferred_learning_style",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience",
		"ls_id", "learning_skill_name", "learning_level",
	})

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.Error(t, err)
	assert.Equal(t, "profile not found", err.Error())
	assert.Nil(t, profile)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_DBError(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnError(errors.New("db connection failed"))

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.Error(t, err)
	assert.NotEqual(t, "user not found", err.Error())
	assert.Nil(t, profile)
	assert.NoError(t, mock.ExpectationsWereMet())
}
