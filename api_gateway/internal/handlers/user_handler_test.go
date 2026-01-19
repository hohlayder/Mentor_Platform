package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserService реализует UserService для тестов
type MockUserService struct {
	mock.Mock
}

type MockPostService struct {
	mock.Mock
}

func (m *MockUserService) CreateUser(ctx context.Context, req *domain.CreateUserRequest) (*domain.CreateUserResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.CreateUserResponse), args.Error(1)
}

func (m *MockUserService) GetUserByID(ctx context.Context, userID string) (*domain.User, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserService) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockUserService) GetUserCount(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return 0, args.Error(1)
	}
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockUserService) DeleteUser(ctx context.Context, userID string) (bool, error) {
	args := m.Called(ctx, userID)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserService) GetProfileById(ctx context.Context, userID string) (*domain.ProfileResponse, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ProfileResponse), args.Error(1)
}

func (m *MockUserService) UpdateProfile(ctx context.Context, userID string, req domain.UpdateProfileRequest) (bool, error) {
	args := m.Called(ctx, userID, req)
	return args.Bool(0), args.Error(1)
}

func (m *MockPostService) GetFavoritePosts(ctx context.Context, userID string, req domain.GetFavoritePostsRequest) (*domain.GetFavoritePostsResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.GetFavoritePostsResponse), args.Error(1)
}

func TestUserHandler_GetUserByID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()

	tests := []struct {
		name           string
		userID         string
		mockUser       *domain.User
		mockError      error
		expectedStatus int
	}{
		{
			name:   "success",
			userID: "123",
			mockUser: &domain.User{
				UserID:    "123",
				FirstName: "John",
				LastName:  "Doe",
				Email:     "john.doe@example.com",
				AvatarURL: nil,
				CreatedAt: createdAt,
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "user not found",
			userID:         "999",
			mockUser:       nil,
			mockError:      errors.New("user not found"),
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockUserService)
			mockPostService := new(MockPostService)
			handler := NewUserHandler(mockService, mockPostService)

			mockService.On("GetUserByID", mock.Anything, tt.userID).Return(tt.mockUser, tt.mockError)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/users/"+tt.userID, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.userID}}

			handler.GetUserByID(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.User
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockUser.UserID, response.UserID)
				assert.Equal(t, tt.mockUser.Email, response.Email)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestUserHandler_GetUserByEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()

	tests := []struct {
		name           string
		email          string
		mockUser       *domain.User
		mockError      error
		expectedStatus int
	}{
		{
			name:  "success",
			email: "test@example.com",
			mockUser: &domain.User{
				UserID:    "123",
				FirstName: "Test",
				LastName:  "User",
				Email:     "test@example.com",
				AvatarURL: nil,
				CreatedAt: createdAt,
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "user not found by email",
			email:          "notfound@example.com",
			mockUser:       nil,
			mockError:      errors.New("user not found"),
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockUserService)
			mockPostService := new(MockPostService)
			handler := NewUserHandler(mockService, mockPostService)

			mockService.On("GetUserByEmail", mock.Anything, tt.email).Return(tt.mockUser, tt.mockError)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/users/email/"+tt.email, nil)
			c.Params = gin.Params{{Key: "email", Value: tt.email}}

			handler.GetUserByEmail(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.User
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockUser.UserID, response.UserID)
				assert.Equal(t, tt.mockUser.Email, response.Email)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestUserHandler_DeleteUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		userID         string
		contextUserID  string
		mockSuccess    bool
		mockError      error
		expectedStatus int
	}{
		{
			name:           "success - same user",
			userID:         "123",
			contextUserID:  "123",
			mockSuccess:    true,
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "forbidden - different user",
			userID:         "123",
			contextUserID:  "456",
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "service error",
			userID:         "123",
			contextUserID:  "123",
			mockSuccess:    false,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:           "unauthorized - no user_id in context",
			userID:         "123",
			contextUserID:  "",
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockUserService)
			mockPostService := new(MockPostService)
			handler := NewUserHandler(mockService, mockPostService)

			if tt.contextUserID == tt.userID && tt.expectedStatus != http.StatusForbidden && tt.contextUserID != "" {
				mockService.On("DeleteUser", mock.Anything, tt.userID).Return(tt.mockSuccess, tt.mockError)
			}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("DELETE", "/users/"+tt.userID, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.userID}}
			
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.DeleteUser(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response bool
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockSuccess, response)
			} else if tt.expectedStatus == http.StatusForbidden {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "FORBIDDEN_ERROR", response.Error)
				assert.Equal(t, "It is not possible to delete another user", response.Message)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestUserHandler_GetProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	createdAt := time.Now()
	avatarURL := "https://example.com/avatar.jpg"
	description := "Experienced mentor"

	tests := []struct {
		name           string
		userID         string
		mockProfile    *domain.ProfileResponse
		mockError      error
		expectedStatus int
	}{
		{
			name:   "success with mentor profile",
			userID: "123",
			mockProfile: &domain.ProfileResponse{
				User: domain.User{
					UserID:    "123",
					FirstName: "John",
					LastName:  "Doe",
					Email:     "john.doe@example.com",
					AvatarURL: &avatarURL,
					CreatedAt: createdAt,
				},
				Mentor: &domain.MentorProfile{
					UserID:            "123",
					WithdrawalAddress: nil,
					Rating:            4.8,
					Description:       &description,
					CreatedAt:         createdAt,
				},
				Student:        nil,
				TeachingSkills: []domain.TeachingSkill{},
				LearningSkills: []domain.LearningSkill{},
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "profile not found",
			userID:         "999",
			mockProfile:    nil,
			mockError:      errors.New("profile not found"),
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockUserService := new(MockUserService)
			mockPostService := new(MockPostService)
			handler := NewUserHandler(mockUserService, mockPostService)

			mockUserService.On("GetProfileById", mock.Anything, tt.userID).Return(tt.mockProfile, tt.mockError)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/profiles/"+tt.userID, nil)
			c.Params = gin.Params{{Key: "id", Value: tt.userID}}

			handler.GetProfile(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.ProfileResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockProfile.User.UserID, response.User.UserID)
				assert.Equal(t, tt.mockProfile.User.Email, response.User.Email)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestUserHandler_UpdateProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	firstName := "Updated"
	lastName := "Name"
	email := "updated@example.com"

	validRequest := domain.UpdateProfileRequest{
		FirstName: &firstName,
		LastName:  &lastName,
		Email:     &email,
	}

	tests := []struct {
		name           string
		userID         string
		contextUserID  string
		requestBody    interface{}
		mockSuccess    bool
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockUserService, userID string, requestBody interface{})
	}{
		{
			name:           "success",
			userID:         "123",
			contextUserID:  "123",
			requestBody:    validRequest,
			mockSuccess:    true,
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockUserService, userID string, requestBody interface{}) {
				req := requestBody.(domain.UpdateProfileRequest)
				mockService.On("UpdateProfile", mock.Anything, userID, req).Return(true, nil)
			},
		},
		{
			name:           "forbidden - different user",
			userID:         "123",
			contextUserID:  "456",
			requestBody:    validRequest,
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusForbidden,
			setupMock:      func(mockService *MockUserService, userID string, requestBody interface{}) {},
		},
		{
			name:           "unauthorized - no user_id in context",
			userID:         "123",
			contextUserID:  "",
			requestBody:    validRequest,
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusUnauthorized,
			setupMock:      func(mockService *MockUserService, userID string, requestBody interface{}) {},
		},
		{
			name:           "invalid request body",
			userID:         "123",
			contextUserID:  "123",
			requestBody:    "invalid json",
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockUserService, userID string, requestBody interface{}) {},
		},
		{
			name:           "service error",
			userID:         "123",
			contextUserID:  "123",
			requestBody:    validRequest,
			mockSuccess:    false,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockUserService, userID string, requestBody interface{}) {
				req := requestBody.(domain.UpdateProfileRequest)
				mockService.On("UpdateProfile", mock.Anything, userID, req).Return(false, errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockUserService)
			mockPostService := new(MockPostService)
			handler := NewUserHandler(mockService, mockPostService)

			// Настраиваем мок только если нужно
			tt.setupMock(mockService, tt.userID, tt.requestBody)

			var requestBody string
			switch body := tt.requestBody.(type) {
			case string:
				requestBody = body
			default:
				jsonBytes, err := json.Marshal(body)
				assert.NoError(t, err)
				requestBody = string(jsonBytes)
			}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("PUT", "/profiles/"+tt.userID, strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "id", Value: tt.userID}}
			
			// Устанавливаем user_id в контекст под правильным ключом
			if tt.contextUserID != "" {
				c.Set("user_id", tt.contextUserID)
			}

			handler.UpdateProfile(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response bool
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockSuccess, response)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "VALIDATION_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusForbidden {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "FORBIDDEN_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "UNAUTHORIZED_ERROR", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "INTERNAL_ERROR", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}
	