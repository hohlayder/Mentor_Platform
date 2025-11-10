package postgres

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"

	"github.com/stretchr/testify/assert"
)

func TestUserRepositoryPostgres_GetProfileByID_Success(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	userID := "user-123"
	createdAt := time.Now()
	avatarURL := "https://example.com/avatar.jpg"
	withdrawal := "withdrawal-123"
	rating := 4.5
	description := "Experienced mentor"
	learningGoals := "Learn Go"
	learningStyle := "visual"
	teachingSkillID := "ts-1"
	learningSkillID := "ls-1"

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description", "mentor_created_at",
		"student_user_id", "learning_goals", "preferred_learning_style", "student_created_at",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience", "ts_created_at",
		"ls_id", "learning_skill_name", "learning_level", "ls_created_at",
	}).AddRow(
		userID, "test@example.com", "John", "Doe", avatarURL, createdAt,
		userID, withdrawal, rating, description, createdAt,
		userID, learningGoals, learningStyle, createdAt,
		teachingSkillID, "Go", "expert", 5, createdAt,
		learningSkillID, "Algorithms", "intermediate", createdAt,
	)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs(userID).
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, userID)

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.Equal(t, userID, profile.User.Id)
	assert.Equal(t, "test@example.com", profile.User.Email)
	assert.NotNil(t, profile.Mentor)
	assert.NotNil(t, profile.Student)
	assert.Len(t, profile.TeachingSkills, 1)
	assert.Len(t, profile.LearningSkills, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_UserNotFound(t *testing.T) {
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

func TestUserRepositoryPostgres_GetProfileByID_ProfileNotFound(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs("user-123").
		WillReturnRows(sqlmock.NewRows(nil))

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
		WillReturnError(errors.New("connection failed"))

	profile, err := repo.GetProfileByID(ctx, "user-123")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "connection failed")
	assert.Nil(t, profile)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_OnlyMentor(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	userID := "user-123"
	createdAt := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description", "mentor_created_at",
		"student_user_id", "learning_goals", "preferred_learning_style", "student_created_at",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience", "ts_created_at",
		"ls_id", "learning_skill_name", "learning_level", "ls_created_at",
	}).AddRow(
		userID, "mentor@example.com", "Jane", "Smith", nil, createdAt,
		userID, "withdrawal-456", 4.8, "Senior mentor", createdAt,
		nil, nil, nil, nil,
		"ts-2", "Kubernetes", "advanced", 3, createdAt,
		nil, nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs(userID).
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, userID)

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.NotNil(t, profile.Mentor)
	assert.Nil(t, profile.Student)
	assert.Len(t, profile.TeachingSkills, 1)
	assert.Len(t, profile.LearningSkills, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_OnlyStudent(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	userID := "user-123"
	createdAt := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description", "mentor_created_at",
		"student_user_id", "learning_goals", "preferred_learning_style", "student_created_at",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience", "ts_created_at",
		"ls_id", "learning_skill_name", "learning_level", "ls_created_at",
	}).AddRow(
		userID, "student@example.com", "Bob", "Wilson", "avatar.jpg", createdAt,
		nil, nil, nil, nil, nil,
		userID, "Learn backend", "practical", createdAt,
		nil, nil, nil, nil, nil,
		"ls-2", "Go", "beginner", createdAt,
	)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs(userID).
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, userID)

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	assert.Nil(t, profile.Mentor)
	assert.NotNil(t, profile.Student)
	assert.Len(t, profile.TeachingSkills, 0)
	assert.Len(t, profile.LearningSkills, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_GetProfileByID_DuplicateSkills(t *testing.T) {
	db, mock := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)
	ctx := context.Background()

	userID := "user-123"
	createdAt := time.Now()
	teachingSkillID := "ts-1"
	learningSkillID := "ls-1"

	rows := sqlmock.NewRows([]string{
		"id", "email", "name", "surname", "avatar_url", "created_at",
		"mentor_user_id", "withdrawal_address", "rating", "description", "mentor_created_at",
		"student_user_id", "learning_goals", "preferred_learning_style", "student_created_at",
		"ts_id", "teaching_skill_name", "teaching_level", "years_of_experience", "ts_created_at",
		"ls_id", "learning_skill_name", "learning_level", "ls_created_at",
	}).AddRow(
		userID, "test@example.com", "John", "Doe", "avatar.jpg", createdAt,
		userID, "withdrawal-123", 4.5, "Mentor", createdAt,
		userID, "Learn", "style", createdAt,
		teachingSkillID, "Go", "expert", 5, createdAt,
		learningSkillID, "Algorithms", "intermediate", createdAt,
	).AddRow( // Duplicate row
		userID, "test@example.com", "John", "Doe", "avatar.jpg", createdAt,
		userID, "withdrawal-123", 4.5, "Mentor", createdAt,
		userID, "Learn", "style", createdAt,
		teachingSkillID, "Go", "expert", 5, createdAt,
		learningSkillID, "Algorithms", "intermediate", createdAt,
	)

	mock.ExpectQuery(`SELECT .* FROM users AS u`).
		WithArgs(userID).
		WillReturnRows(rows)

	profile, err := repo.GetProfileByID(ctx, userID)

	assert.NoError(t, err)
	assert.NotNil(t, profile)
	// Skills should be deduplicated
	assert.Len(t, profile.TeachingSkills, 1)
	assert.Len(t, profile.LearningSkills, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserRepositoryPostgres_buildUserProfileFromRows_EmptyRows(t *testing.T) {
	db, _ := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)

	profile := repo.buildUserProfileFromRows([]domain.UserProfileRow{})

	assert.Nil(t, profile)
}

func TestUserRepositoryPostgres_buildUserProfileFromRows_CompleteProfile(t *testing.T) {
	db, _ := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)

	userID := "user-123"
	createdAt := time.Now()
	mentorUserID := userID
	studentUserID := userID
	teachingSkillID := "ts-1"
	learningSkillID := "ls-1"
	avatarURL := "avatar.jpg"
	withdrawal := "withdrawal-123"
	rating := 4.5
	description := "Experienced mentor"
	learningGoals := "Learn Go"
	learningStyle := "visual"
	teachingSkillName := "Go"
	teachingLevel := "expert"
	teachingYears := int32(5)
	learningSkillName := "Algorithms"
	learningLevel := "intermediate"

	rows := []domain.UserProfileRow{
		{
			ID:        userID,
			Email:     "test@example.com",
			Name:      "John",
			Surname:   "Doe",
			AvatarURL: &avatarURL,
			CreatedAt: createdAt,

			MUserID:             &mentorUserID,
			WithdrawalAddress:   &withdrawal,
			Rating:              &rating,
			Description:         &description,
			MCreatedAt:          &createdAt,

			SUserID:                 &studentUserID,
			LearningGoals:          &learningGoals,
			PreferredLearningStyle: &learningStyle,
			SCreatedAt:              &createdAt,

			TsID:               &teachingSkillID,
			TsSkillName:        &teachingSkillName,
			TsProficiencyLevel: &teachingLevel,
			TsYears:            &teachingYears,
			TsCreatedAt:        &createdAt,

			LsID:               &learningSkillID,
			LsSkillName:        &learningSkillName,
			LsProficiencyLevel: &learningLevel,
			LsCreatedAt:        &createdAt,
		},
	}

	profile := repo.buildUserProfileFromRows(rows)

	assert.NotNil(t, profile)
	assert.Equal(t, userID, profile.User.Id)
	assert.Equal(t, "test@example.com", profile.User.Email)
	assert.NotNil(t, profile.User.AvatarURL)
	assert.Equal(t, "avatar.jpg", *profile.User.AvatarURL)
	assert.NotNil(t, profile.Mentor)
	assert.Equal(t, userID, profile.Mentor.UserId)
	assert.NotNil(t, profile.Student)
	assert.Equal(t, userID, profile.Student.UserId)
	assert.Len(t, profile.TeachingSkills, 1)
	assert.Len(t, profile.LearningSkills, 1)
}

func TestUserRepositoryPostgres_buildUserProfileFromRows_NullFields(t *testing.T) {
	db, _ := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)

	userID := "user-123"
	createdAt := time.Now()

	rows := []domain.UserProfileRow{
		{
			ID:        userID,
			Email:     "test@example.com",
			Name:      "John",
			Surname:   "Doe",
			AvatarURL: nil,
			CreatedAt: createdAt,

			MUserID: nil,
			SUserID: nil,
			TsID:    nil,
			LsID:    nil,
		},
	}

	profile := repo.buildUserProfileFromRows(rows)

	assert.NotNil(t, profile)
	assert.Equal(t, userID, profile.User.Id)
	assert.Nil(t, profile.User.AvatarURL)
	assert.Nil(t, profile.Mentor)
	assert.Nil(t, profile.Student)
	assert.Len(t, profile.TeachingSkills, 0)
	assert.Len(t, profile.LearningSkills, 0)
}

func TestUserRepositoryPostgres_buildUserProfileFromRows_MultipleSkills(t *testing.T) {
	db, _ := NewMock()
	defer db.Close()

	repo := NewUserRepositoryPostgres(db)

	userID := "user-123"
	createdAt := time.Now()
	mentorUserID := userID
	studentUserID := userID
	teachingSkill1 := "ts-1"
	teachingSkill2 := "ts-2"
	learningSkill1 := "ls-1"
	learningSkill2 := "ls-2"
	skillName1 := "Go"
	skillName2 := "Kubernetes"
	skillLevel := "expert"
	learningSkillName1 := "Algorithms"
	learningSkillName2 := "System Design"
	learningLevel := "intermediate"
	years := int32(5)

	rows := []domain.UserProfileRow{
		{
			ID:        userID,
			Email:     "test@example.com",
			Name:      "John",
			Surname:   "Doe",
			AvatarURL: nil,
			CreatedAt: createdAt,

			MUserID: &mentorUserID,
			SUserID: &studentUserID,

			TsID:               &teachingSkill1,
			TsSkillName:        &skillName1,
			TsProficiencyLevel: &skillLevel,
			TsYears:            &years,
			TsCreatedAt:        &createdAt,

			LsID:               &learningSkill1,
			LsSkillName:        &learningSkillName1,
			LsProficiencyLevel: &learningLevel,
			LsCreatedAt:        &createdAt,
		},
		{
			ID:        userID,
			Email:     "test@example.com",
			Name:      "John",
			Surname:   "Doe",
			AvatarURL: nil,
			CreatedAt: createdAt,

			MUserID: &mentorUserID,
			SUserID: &studentUserID,

			TsID:               &teachingSkill2,
			TsSkillName:        &skillName2,
			TsProficiencyLevel: &skillLevel,
			TsYears:            &years,
			TsCreatedAt:        &createdAt,

			LsID:               &learningSkill2,
			LsSkillName:        &learningSkillName2,
			LsProficiencyLevel: &learningLevel,
			LsCreatedAt:        &createdAt,
		},
	}

	profile := repo.buildUserProfileFromRows(rows)

	assert.NotNil(t, profile)
	assert.Len(t, profile.TeachingSkills, 2)
	assert.Len(t, profile.LearningSkills, 2)
}