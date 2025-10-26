package grpc

import (
	"context"
	"errors"
	"testing"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/user_service/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Mock сервиса
type MockUserProfileService struct {
	mock.Mock
}

func (m *MockUserProfileService) CreateUser(ctx context.Context, name, surname, email string) (string, error) {
	args := m.Called(ctx, name, surname, email)
	return args.String(0), args.Error(1)
}

func (m *MockUserProfileService) GetUserById(ctx context.Context, id string) (*domain.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserProfileService) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserProfileService) DeleteUser(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserProfileService) GetProfileById(ctx context.Context, id string) (*domain.UserProfile, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.UserProfile), args.Error(1)
}

func (m *MockUserProfileService) UpdateProfile(ctx context.Context, profile *domain.UpdateProfile) error {
	args := m.Called(ctx, profile)
	return args.Error(0)
}

func TestGRPCHandler_CreateUser_Success(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.CreateUserRequest{
		FirstName: "John",
		LastName:  "Doe",
		Email:     "john@example.com",
	}

	mockService.On("CreateUser", ctx, "John", "Doe", "john@example.com").Return("user-123", nil)

	resp, err := handler.CreateUser(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "user-123", resp.UserId)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_CreateUser_Error(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.CreateUserRequest{
		FirstName: "John",
		LastName:  "Doe",
		Email:     "john@example.com",
	}

	mockService.On("CreateUser", ctx, "John", "Doe", "john@example.com").Return("", errors.New("create error"))

	resp, err := handler.CreateUser(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Equal(t, codes.Internal, status.Code(err))
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_GetUserById_Success(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.GetUserByIdRequest{UserId: "user-123"}

	expectedUser := &domain.User{
		Id:        "user-123",
		Name:      "John",
		Surname:   "Doe",
		Email:     "john@example.com",
		AvatarURL: nil,
	}

	mockService.On("GetUserById", ctx, "user-123").Return(expectedUser, nil)

	resp, err := handler.GetUserById(ctx, req)

	assert.NoError(t, err)
	assert.Equal(t, "user-123", resp.User.UserId)
	assert.Equal(t, "John", resp.User.FirstName)
	assert.Equal(t, "Doe", resp.User.LastName)
	assert.Equal(t, "john@example.com", resp.User.Email)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_GetProfileById_Success(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.GetProfileByIdRequest{UserId: "user-123"}

	// Создаем тестовый профиль
	rating := 4.5
	expectedProfile := &domain.UserProfile{
		User: domain.User{
			Id:        "user-123",
			Name:      "John",
			Surname:   "Doe",
			Email:     "john@example.com",
			AvatarURL: nil,
		},
		Mentor: &domain.Mentor{
			UserId:      "user-123",
			Withdrawal:  stringPtr("wallet123"),
			Rating:      &rating,
			Description: stringPtr("Experienced mentor"),
		},
		Student: &domain.Student{
			UserId:                "user-123",
			LearningGoals:         stringPtr("Learn Go"),
			PreferredLearningStyle: stringPtr("practice"),
		},
		TeachingSkills: []domain.TeachingSkill{
			{
				Id:                "ts-1",
				UserId:            "user-123",
				SkillName:         "Go",
				ProficiencyLevel:  "expert",
				YearsOfExperience: 5,
			},
		},
		LearningSkills: []domain.LearningSkill{
			{
				Id:               "ls-1",
				UserId:           "user-123",
				SkillName:        "Docker",
				ProficiencyLevel: "intermediate",
			},
		},
	}

	mockService.On("GetProfileById", ctx, "user-123").Return(expectedProfile, nil)

	resp, err := handler.GetProfileById(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, "user-123", resp.User.UserId)
	assert.NotNil(t, resp.Mentor)
	assert.NotNil(t, resp.Student)
	assert.Len(t, resp.TeachingSkills, 1)
	assert.Len(t, resp.LearningSkills, 1)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_GetProfileById_NoMentorStudent(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.GetProfileByIdRequest{UserId: "user-123"}

	expectedProfile := &domain.UserProfile{
		User: domain.User{
			Id:        "user-123",
			Name:      "John",
			Surname:   "Doe",
			Email:     "john@example.com",
			AvatarURL: nil,
		},
		// Mentor и Student = nil
		TeachingSkills: []domain.TeachingSkill{},
		LearningSkills: []domain.LearningSkill{},
	}

	mockService.On("GetProfileById", ctx, "user-123").Return(expectedProfile, nil)

	resp, err := handler.GetProfileById(ctx, req)

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Nil(t, resp.Mentor)
	assert.Nil(t, resp.Student)
	assert.Empty(t, resp.TeachingSkills)
	assert.Empty(t, resp.LearningSkills)
	mockService.AssertExpectations(t)
}


func TestGRPCHandler_UpdateProfile_Success(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId:    "user-123",
		FirstName: stringPtr("John"),
		LastName:  stringPtr("Doe"),
		Email:     stringPtr("john@example.com"),
		MentorData: &userv1.MentorUpdate{
			WithdrawalAddress: stringPtr("wallet123"),
			Description:       stringPtr("Experienced mentor"),
		},
		LearningSkills: &userv1.LearningSkillsUpdate{
			LearningSkills: []*userv1.LearningSkillUpdate{
				{
					SkillName:        "Go",
					ProficiencyLevel: "intermediate",
				},
			},
		},
	}

	mockService.On("UpdateProfile", ctx, mock.AnythingOfType("*domain.UpdateProfile")).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}



func TestGRPCHandler_UpdateProfile_OnlyTeachingSkills(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		TeachingSkills: &userv1.TeachingSkillsUpdate{
			TeachingSkills: []*userv1.TeachingSkillUpdate{
				{
					SkillName:          "Java",
					ProficiencyLevel:   "expert",
					YearsOfExperience:  5,
				},
			},
		},
	}

	mockService.On("UpdateProfile", ctx, mock.AnythingOfType("*domain.UpdateProfile")).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_Error(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
	}

	mockService.On("UpdateProfile", ctx, mock.AnythingOfType("*domain.UpdateProfile")).Return(errors.New("update error"))

	resp, err := handler.UpdateProfile(ctx, req)

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Equal(t, codes.Internal, status.Code(err))
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_OnlyBasicInfo(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId:    "user-123",
		FirstName: stringPtr("John"),
		LastName:  stringPtr("Doe"),
		Email:     stringPtr("john@example.com"),
		// MentorData, StudentData, Skills = nil
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			*profile.Name == "John" &&
			*profile.Surname == "Doe" &&
			*profile.Email == "john@example.com" &&
			profile.Mentor == nil &&
			profile.Student == nil &&
			profile.LearningSkill == nil &&
			profile.TeachingSkills == nil
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_OnlyMentorData(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		MentorData: &userv1.MentorUpdate{
			WithdrawalAddress: stringPtr("wallet123"),
			Description:       stringPtr("Senior developer"),
		},
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.Mentor != nil &&
			*profile.Mentor.Withdrawal == "wallet123" &&
			*profile.Mentor.Description == "Senior developer" &&
			profile.Student == nil &&
			profile.LearningSkill == nil &&
			profile.TeachingSkills == nil
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_OnlyStudentData(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		StudentData: &userv1.StudentUpdate{
			LearningGoals:         stringPtr("Learn microservices"),
			PreferredLearningStyle: stringPtr("video"),
		},
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.Student != nil &&
			*profile.Student.LearningGoals == "Learn microservices" &&
			*profile.Student.PreferredLearningStyle == "video" &&
			profile.Mentor == nil &&
			profile.LearningSkill == nil &&
			profile.TeachingSkills == nil
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_EmptyTeachingSkills(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		TeachingSkills: &userv1.TeachingSkillsUpdate{
			TeachingSkills: []*userv1.TeachingSkillUpdate{}, // пустой массив
		},
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.TeachingSkills != nil &&
			len(*profile.TeachingSkills) == 0
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_MultipleTeachingSkills(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		TeachingSkills: &userv1.TeachingSkillsUpdate{
			TeachingSkills: []*userv1.TeachingSkillUpdate{
				{
					SkillName:          "Go",
					ProficiencyLevel:   "expert",
					YearsOfExperience:  5,
				},
				{
					SkillName:          "Docker",
					ProficiencyLevel:   "intermediate",
					YearsOfExperience:  2,
				},
			},
		},
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.TeachingSkills != nil &&
			len(*profile.TeachingSkills) == 2 &&
			(*profile.TeachingSkills)[0].SkillName == "Go" &&
			(*profile.TeachingSkills)[1].SkillName == "Docker"
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_NilOptionalFields(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId: "user-123",
		// Все optional поля = nil
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.Email == nil &&
			profile.Name == nil &&
			profile.Surname == nil &&
			profile.AvatarURL == nil &&
			profile.Mentor == nil &&
			profile.Student == nil &&
			profile.LearningSkill == nil &&
			profile.TeachingSkills == nil
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_UpdateProfile_WithAvatarURL(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.UpdateProfileRequest{
		UserId:    "user-123",
		AvatarUrl: stringPtr("https://example.com/avatar.jpg"),
	}

	mockService.On("UpdateProfile", ctx, mock.MatchedBy(func(profile *domain.UpdateProfile) bool {
		return profile.Id == "user-123" &&
			profile.AvatarURL != nil &&
			*profile.AvatarURL == "https://example.com/avatar.jpg"
	})).Return(nil)

	resp, err := handler.UpdateProfile(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}

func TestGRPCHandler_DeleteUser_Success(t *testing.T) {
	mockService := new(MockUserProfileService)
	handler := NewGRPCHandler(mockService)

	ctx := context.Background()
	req := &userv1.DeleteUserRequest{UserId: "user-123"}

	mockService.On("DeleteUser", ctx, "user-123").Return(nil)

	resp, err := handler.DeleteUser(ctx, req)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	mockService.AssertExpectations(t)
}


func stringPtr(s string) *string {
	return &s
}