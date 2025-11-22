package service

import (
	"context"
	"errors"
	"testing"
	"time"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// MockUserClient реализует интерфейс UserClient для тестов
type MockUserClient struct {
	mock.Mock
}

func (m *MockUserClient) CreateUser(ctx context.Context, in *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.CreateUserResponse), args.Error(1)
}

func (m *MockUserClient) GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetUserByIdResponse), args.Error(1)
}

func (m *MockUserClient) GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetUserByEmailResponse), args.Error(1)
}

func (m *MockUserClient) DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.DeleteUserResponse), args.Error(1)
}

func (m *MockUserClient) GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.GetProfileByIdResponse), args.Error(1)
}

func (m *MockUserClient) UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.UpdateProfileResponse), args.Error(1)
}

func (m *MockUserClient) UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest) (*userv1.UploadAvatarResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.UploadAvatarResponse), args.Error(1)
}

func (m *MockUserClient) DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest) (*userv1.DeleteAvatarResponse, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*userv1.DeleteAvatarResponse), args.Error(1)
}

func TestUserService_CreateUser(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		request        *domain.CreateUserRequest
		mockResponse   *userv1.CreateUserResponse
		mockError      error
		expectedResult *domain.CreateUserResponse
		expectedError  string
	}{
		{
			name: "success",
			request: &domain.CreateUserRequest{
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
			},
			mockResponse: &userv1.CreateUserResponse{
				UserId: "user-123",
			},
			mockError: nil,
			expectedResult: &domain.CreateUserResponse{
				UserID: "user-123",
			},
			expectedError: "",
		},
		{
			name: "client error",
			request: &domain.CreateUserRequest{
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
			},
			mockResponse:   nil,
			mockError:      errors.New("create user error"),
			expectedResult: nil,
			expectedError:  "create user error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("CreateUser", ctx, &userv1.CreateUserRequest{
				FirstName: tt.request.FirstName,
				LastName:  tt.request.LastName,
				Email:     tt.request.Email,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := userService.CreateUser(ctx, tt.request)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestUserService_GetUserByID(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Now().UTC()
	avatarURL := "https://example.com/avatar.jpg"

	tests := []struct {
		name           string
		userID         string
		mockResponse   *userv1.GetUserByIdResponse
		mockError      error
		expectedResult *domain.User
		expectedError  string
	}{
		{
			name:   "success with avatar",
			userID: "user-123",
			mockResponse: &userv1.GetUserByIdResponse{
				User: &userv1.User{
					UserId:    "user-123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarUrl: &avatarURL,
					CreatedAt: timestamppb.New(createdAt),
				},
			},
			mockError: nil,
			expectedResult: &domain.User{
				UserID:    "user-123",
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
				AvatarURL: &avatarURL,
				CreatedAt: createdAt,
			},
			expectedError: "",
		},
		{
			name:   "success without avatar",
			userID: "user-123",
			mockResponse: &userv1.GetUserByIdResponse{
				User: &userv1.User{
					UserId:    "user-123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarUrl: nil,
					CreatedAt: timestamppb.New(createdAt),
				},
			},
			mockError: nil,
			expectedResult: &domain.User{
				UserID:    "user-123",
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
				AvatarURL: nil,
				CreatedAt: createdAt,
			},
			expectedError: "",
		},
		{
			name:           "user not found",
			userID:         "non-existent",
			mockResponse:   nil,
			mockError:      errors.New("user not found"),
			expectedResult: nil,
			expectedError:  "user not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("GetUserById", ctx, &userv1.GetUserByIdRequest{
				UserId: tt.userID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := userService.GetUserByID(ctx, tt.userID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestUserService_GetUserByEmail(t *testing.T) {
	ctx := context.Background()
	createdAt := time.Now().UTC()

	tests := []struct {
		name           string
		email          string
		mockResponse   *userv1.GetUserByEmailResponse
		mockError      error
		expectedResult *domain.User
		expectedError  string
	}{
		{
			name:  "success",
			email: "john.doe@example.com",
			mockResponse: &userv1.GetUserByEmailResponse{
				User: &userv1.User{
					UserId:    "user-123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarUrl: nil,
					CreatedAt: timestamppb.New(createdAt),
				},
			},
			mockError: nil,
			expectedResult: &domain.User{
				UserID:    "user-123",
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
				AvatarURL: nil,
				CreatedAt: createdAt,
			},
			expectedError: "",
		},
		{
			name:           "client error",
			email:          "notfound@example.com",
			mockResponse:   nil,
			mockError:      errors.New("user not found"),
			expectedResult: nil,
			expectedError:  "user not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("GetUserByEmail", ctx, &userv1.GetUserByEmailRequest{
				Email: tt.email,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := userService.GetUserByEmail(ctx, tt.email)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestUserService_DeleteUser(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		userID         string
		mockResponse   *userv1.DeleteUserResponse
		mockError      error
		expectedResult bool
		expectedError  string
	}{
		{
			name:   "success",
			userID: "user-123",
			mockResponse: &userv1.DeleteUserResponse{
				Success: true,
			},
			mockError:      nil,
			expectedResult: true,
			expectedError:  "",
		},
		{
			name:           "delete error",
			userID:         "user-123",
			mockResponse:   nil,
			mockError:      errors.New("delete failed"),
			expectedResult: false,
			expectedError:  "delete failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("DeleteUser", ctx, &userv1.DeleteUserRequest{
				UserId: tt.userID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := userService.DeleteUser(ctx, tt.userID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestUserService_GetProfileById(t *testing.T) {
	ctx := context.Background()
	
	createdAt := time.Date(2023, time.January, 1, 12, 0, 0, 0, time.UTC)
	avatarURL := "https://example.com/avatar.jpg"
	withdrawalAddress := "0x1234567890"
	description := "Experienced mentor"
	learningGoals := "Learn Go and microservices"
	preferredLearningStyle := "Visual"

	tests := []struct {
		name           string
		userID         string
		mockResponse   *userv1.GetProfileByIdResponse
		mockError      error
		expectedResult *domain.ProfileResponse
		expectedError  string
	}{
		{
			name:   "success with full profile",
			userID: "user-123",
			mockResponse: &userv1.GetProfileByIdResponse{
				User: &userv1.User{
					UserId:    "user-123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarUrl: &avatarURL,
					CreatedAt: timestamppb.New(createdAt),
				},
				Mentor: &userv1.MentorProfile{
					UserId:             "user-123",
					WithdrawalAddress:  &withdrawalAddress,
					Rating:             4.8,
					Description:        &description,
					CreatedAt:          timestamppb.New(createdAt),
				},
				Student: &userv1.StudentProfile{
					UserId:                 "user-123",
					LearningGoals:          &learningGoals,
					PreferredLearningStyle: &preferredLearningStyle,
					CreatedAt:              timestamppb.New(createdAt),
				},
				TeachingSkills: []*userv1.TeachingSkill{
					{
						SkillId:            "skill-1",
						UserId:             "user-123",
						SkillName:          "Go Programming",
						ProficiencyLevel:   "Expert",
						YearsOfExperience:  5,
						CreatedAt:          timestamppb.New(createdAt),
					},
				},
				LearningSkills: []*userv1.LearningSkill{
					{
						SkillId:          "skill-2",
						UserId:           "user-123",
						SkillName:        "Kubernetes",
						ProficiencyLevel: "Beginner",
						CreatedAt:        timestamppb.New(createdAt),
					},
				},
			},
			mockError: nil,
			expectedResult: &domain.ProfileResponse{
				User: domain.User{
					UserID:    "user-123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarURL: &avatarURL,
					CreatedAt: createdAt,
				},
				Mentor: &domain.MentorProfile{
					UserID:             "user-123",
					WithdrawalAddress:  &withdrawalAddress,
					Rating:             4.8,
					Description:        &description,
					CreatedAt:          createdAt,
				},
				Student: &domain.StudentProfile{
					UserID:                 "user-123",
					LearningGoals:          &learningGoals,
					PreferredLearningStyle: &preferredLearningStyle,
					CreatedAt:              createdAt,
				},
				TeachingSkills: []domain.TeachingSkill{
					{
						SkillID:            "skill-1",
						UserID:             "user-123",
						SkillName:          "Go Programming",
						ProficiencyLevel:   "Expert",
						YearsOfExperience:  5,
						CreatedAt:          createdAt,
					},
				},
				LearningSkills: []domain.LearningSkill{
					{
						SkillID:          "skill-2",
						UserID:           "user-123",
						SkillName:        "Kubernetes",
						ProficiencyLevel: "Beginner",
						CreatedAt:        createdAt,
					},
				},
			},
			expectedError: "",
		},
		{
			name:   "success with mentor only",
			userID: "user-456",
			mockResponse: &userv1.GetProfileByIdResponse{
				User: &userv1.User{
					UserId:    "user-456",
					FirstName: "Jane",
					LastName:  "Smith",
					Email:     "jane.smith@example.com",
					AvatarUrl: nil,
					CreatedAt: timestamppb.New(createdAt),
				},
				Mentor: &userv1.MentorProfile{
					UserId:             "user-456",
					WithdrawalAddress:  &withdrawalAddress,
					Rating:             4.5,
					Description:        &description,
					CreatedAt:          timestamppb.New(createdAt),
				},
				Student:        nil,
				TeachingSkills: []*userv1.TeachingSkill{},
				LearningSkills: []*userv1.LearningSkill{},
			},
			mockError: nil,
			expectedResult: &domain.ProfileResponse{
				User: domain.User{
					UserID:    "user-456",
					FirstName: "Jane",
					LastName:  "Smith",
					Email:     "jane.smith@example.com",
					AvatarURL: nil,
					CreatedAt: createdAt,
				},
				Mentor: &domain.MentorProfile{
					UserID:             "user-456",
					WithdrawalAddress:  &withdrawalAddress,
					Rating:             4.5,
					Description:        &description,
					CreatedAt:          createdAt,
				},
				Student:        nil,
				TeachingSkills: nil, 
				LearningSkills: nil, 
			},
			expectedError: "",
		},
		{
			name:   "success with student only",
			userID: "user-789",
			mockResponse: &userv1.GetProfileByIdResponse{
				User: &userv1.User{
					UserId:    "user-789",
					FirstName: "Bob",
					LastName:  "Johnson",
					Email:     "bob.johnson@example.com",
					AvatarUrl: &avatarURL,
					CreatedAt: timestamppb.New(createdAt),
				},
				Mentor: nil,
				Student: &userv1.StudentProfile{
					UserId:                 "user-789",
					LearningGoals:          &learningGoals,
					PreferredLearningStyle: nil,
					CreatedAt:              timestamppb.New(createdAt),
				},
				TeachingSkills: []*userv1.TeachingSkill{},
				LearningSkills: []*userv1.LearningSkill{
					{
						SkillId:          "skill-3",
						UserId:           "user-789",
						SkillName:        "Docker",
						ProficiencyLevel: "Intermediate",
						CreatedAt:        timestamppb.New(createdAt),
					},
				},
			},
			mockError: nil,
			expectedResult: &domain.ProfileResponse{
				User: domain.User{
					UserID:    "user-789",
					FirstName: "Bob",
					LastName:  "Johnson",
					Email:     "bob.johnson@example.com",
					AvatarURL: &avatarURL,
					CreatedAt: createdAt,
				},
				Mentor: nil,
				Student: &domain.StudentProfile{
					UserID:                 "user-789",
					LearningGoals:          &learningGoals,
					PreferredLearningStyle: nil,
					CreatedAt:              createdAt,
				},
				TeachingSkills: nil, // Ожидаем nil вместо пустого slice
				LearningSkills: []domain.LearningSkill{
					{
						SkillID:          "skill-3",
						UserID:           "user-789",
						SkillName:        "Docker",
						ProficiencyLevel: "Intermediate",
						CreatedAt:        createdAt,
					},
				},
			},
			expectedError: "",
		},
		{
			name:   "success with empty profile",
			userID: "user-999",
			mockResponse: &userv1.GetProfileByIdResponse{
				User: &userv1.User{
					UserId:    "user-999",
					FirstName: "Alice",
					LastName:  "Brown",
					Email:     "alice.brown@example.com",
					AvatarUrl: nil,
					CreatedAt: timestamppb.New(createdAt),
				},
				Mentor:         nil,
				Student:        nil,
				TeachingSkills: []*userv1.TeachingSkill{},
				LearningSkills: []*userv1.LearningSkill{},
			},
			mockError: nil,
			expectedResult: &domain.ProfileResponse{
				User: domain.User{
					UserID:    "user-999",
					FirstName: "Alice",
					LastName:  "Brown",
					Email:     "alice.brown@example.com",
					AvatarURL: nil,
					CreatedAt: createdAt,
				},
				Mentor:         nil,
				Student:        nil,
				TeachingSkills: nil, // Ожидаем nil
				LearningSkills: nil, // Ожидаем nil
			},
			expectedError: "",
		},
		{
			name:           "profile not found",
			userID:         "non-existent-user",
			mockResponse:   nil,
			mockError:      errors.New("profile not found"),
			expectedResult: nil,
			expectedError:  "profile not found",
		},
		{
			name:           "client error",
			userID:         "user-error",
			mockResponse:   nil,
			mockError:      errors.New("internal server error"),
			expectedResult: nil,
			expectedError:  "internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("GetProfileById", ctx, &userv1.GetProfileByIdRequest{
				UserId: tt.userID,
			}).Return(tt.mockResponse, tt.mockError)

			result, err := userService.GetProfileById(ctx, tt.userID)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				
				// Используем кастомное сравнение для корректной обработки nil slices
				assertProfileResponseEqual(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

// Вспомогательная функция для сравнения ProfileResponse с учетом nil slices
func assertProfileResponseEqual(t *testing.T, expected, actual *domain.ProfileResponse) {
	t.Helper()
	
	if expected == nil && actual == nil {
		return
	}
	if expected == nil || actual == nil {
		t.Errorf("One profile response is nil: expected=%v, actual=%v", expected, actual)
		return
	}
	
	// Сравниваем User
	assert.Equal(t, expected.User, actual.User)
	
	// Сравниваем Mentor
	if expected.Mentor == nil {
		assert.Nil(t, actual.Mentor)
	} else {
		assert.NotNil(t, actual.Mentor)
		assert.Equal(t, *expected.Mentor, *actual.Mentor)
	}
	
	// Сравниваем Student
	if expected.Student == nil {
		assert.Nil(t, actual.Student)
	} else {
		assert.NotNil(t, actual.Student)
		assert.Equal(t, *expected.Student, *actual.Student)
	}
	
	// Сравниваем TeachingSkills (разрешаем и nil и empty slices)
	if expected.TeachingSkills == nil {
		// Ожидаем nil, но принимаем и nil и empty slice
		if actual.TeachingSkills != nil {
			assert.Empty(t, actual.TeachingSkills, "TeachingSkills should be nil or empty")
		}
	} else {
		assert.NotNil(t, actual.TeachingSkills)
		assert.Equal(t, expected.TeachingSkills, actual.TeachingSkills)
	}
	
	// Сравниваем LearningSkills (разрешаем и nil и empty slices)
	if expected.LearningSkills == nil {
		// Ожидаем nil, но принимаем и nil и empty slice
		if actual.LearningSkills != nil {
			assert.Empty(t, actual.LearningSkills, "LearningSkills should be nil or empty")
		}
	} else {
		assert.NotNil(t, actual.LearningSkills)
		assert.Equal(t, expected.LearningSkills, actual.LearningSkills)
	}
}


func TestUserService_UpdateProfile(t *testing.T) {
	ctx := context.Background()
	avatarURL := "https://example.com/avatar.jpg"
	firstName := "John"
	lastName := "Doe Updated"
	email := "john.updated@example.com"
	withdrawalAddress := "0xUPDATED123"
	description := "Updated description"
	learningGoals := "Updated goals"
	preferredLearningStyle := "Auditory"

	tests := []struct {
		name           string
		userID         string
		request        domain.UpdateProfileRequest
		mockResponse   *userv1.UpdateProfileResponse
		mockError      error
		expectedResult bool
		expectedError  string
	}{
		{
			name:   "success with all fields",
			userID: "user-123",
			request: domain.UpdateProfileRequest{
				FirstName: &firstName,
				LastName:  &lastName,
				Email:     &email,
				AvatarURL: &avatarURL,
				MentorData: &domain.MentorUpdate{
					WithdrawalAddress: &withdrawalAddress,
					Description:       &description,
				},
				StudentData: &domain.StudentUpdate{
					LearningGoals:          &learningGoals,
					PreferredLearningStyle: &preferredLearningStyle,
				},
				TeachingSkills: &domain.TeachingSkillsUpdate{
					TeachingSkills: []domain.TeachingSkillUpdate{
						{
							SkillName:         "Updated Skill",
							ProficiencyLevel:  "Intermediate",
							YearsOfExperience: 3,
						},
					},
				},
				LearningSkills: &domain.LearningSkillsUpdate{
					LearningSkills: []domain.LearningSkillUpdate{
						{
							SkillName:        "New Learning Skill",
							ProficiencyLevel: "Beginner",
						},
					},
				},
			},
			mockResponse: &userv1.UpdateProfileResponse{
				Success: true,
			},
			mockError:      nil,
			expectedResult: true,
			expectedError:  "",
		},
		{
			name:   "success with partial update",
			userID: "user-123",
			request: domain.UpdateProfileRequest{
				FirstName: &firstName,
				LastName:  &lastName,
				Email:     nil,
				AvatarURL: nil,
				MentorData: nil,
				StudentData: &domain.StudentUpdate{
					LearningGoals: &learningGoals,
				},
				TeachingSkills: nil,
				LearningSkills: nil,
			},
			mockResponse: &userv1.UpdateProfileResponse{
				Success: true,
			},
			mockError:      nil,
			expectedResult: true,
			expectedError:  "",
		},
		{
			name:   "update error",
			userID: "user-123",
			request: domain.UpdateProfileRequest{
				FirstName: &firstName,
				LastName:  &lastName,
				Email:     &email,
			},
			mockResponse:   nil,
			mockError:      errors.New("update failed"),
			expectedResult: false,
			expectedError:  "update failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := new(MockUserClient)
			userService := NewUserService(mockClient)

			mockClient.On("UpdateProfile", ctx, mock.AnythingOfType("*userv1.UpdateProfileRequest")).Return(tt.mockResponse, tt.mockError)

			result, err := userService.UpdateProfile(ctx, tt.userID, tt.request)

			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}