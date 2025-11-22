package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Register(ctx context.Context, name string, surname string, email string, password string) (string, error) {
	args := m.Called(ctx, name, surname, email, password)
	return args.String(0), args.Error(1)
}

func (m *MockAuthService) Login(ctx context.Context, email string, password string) (*domain.TokenPair, error) {
	args := m.Called(ctx, email, password)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.TokenPair), args.Error(1)
}

func (m *MockAuthService) RefreshToken(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.TokenPair), args.Error(1)
}

func (m *MockAuthService) Logout(ctx context.Context, refreshToken string) (bool, error) {
	args := m.Called(ctx, refreshToken)
	return args.Bool(0), args.Error(1)
}

func TestAuthHandler_Register(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		requestBody    interface{}
		mockUserID     string
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockAuthService, requestBody interface{})
	}{
		{
			name: "success",
			requestBody: domain.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "john.doe@example.com",
				Password: "password123",
			},
			mockUserID:     "user123",
			mockError:      nil,
			expectedStatus: http.StatusCreated,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RegisterRequest)
				mockService.On("Register", mock.Anything, req.Name, req.Surname, req.Email, req.Password).Return("user123", nil)
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockUserID:     "",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "validation error - empty name",
			requestBody: domain.RegisterRequest{
				Name:     "",
				Surname:  "Doe",
				Email:    "john.doe@example.com",
				Password: "password123",
			},
			mockUserID:     "",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "validation error - short password",
			requestBody: domain.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "john.doe@example.com",
				Password: "123",
			},
			mockUserID:     "",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "service error",
			requestBody: domain.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "john.doe@example.com",
				Password: "password123",
			},
			mockUserID:     "",
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RegisterRequest)
				mockService.On("Register", mock.Anything, req.Name, req.Surname, req.Email, req.Password).Return("", errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewAuthHandler(mockService)

			tt.setupMock(mockService, tt.requestBody)

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
			c.Request = httptest.NewRequest("POST", "/auth/register", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")

			handler.Register(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusCreated {
				var response domain.RegisterResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockUserID, response.ID)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Bad Request", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Internal Server Error", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_Login(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		requestBody    interface{}
		mockTokens     *domain.TokenPair
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockAuthService, requestBody interface{})
	}{
		{
			name: "success",
			requestBody: domain.LoginRequest{
				Email:    "john.doe@example.com",
				Password: "password123",
			},
			mockTokens: &domain.TokenPair{
				AccessToken:  "access_token",
				RefreshToken: "refresh_token",
				ExpiresIn:    3600,
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.LoginRequest)
				mockService.On("Login", mock.Anything, req.Email, req.Password).Return(&domain.TokenPair{
					AccessToken:  "access_token",
					RefreshToken: "refresh_token",
					ExpiresIn:    3600,
				}, nil)
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockTokens:     nil,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "invalid credentials",
			requestBody: domain.LoginRequest{
				Email:    "john.doe@example.com",
				Password: "wrongpassword",
			},
			mockTokens:     nil,
			mockError:      errors.New("invalid credentials"),
			expectedStatus: http.StatusUnauthorized,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.LoginRequest)
				mockService.On("Login", mock.Anything, req.Email, req.Password).Return((*domain.TokenPair)(nil), errors.New("invalid credentials"))
			},
		},
		{
			name: "service error",
			requestBody: domain.LoginRequest{
				Email:    "john.doe@example.com",
				Password: "password123",
			},
			mockTokens:     nil,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusUnauthorized,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.LoginRequest)
				mockService.On("Login", mock.Anything, req.Email, req.Password).Return((*domain.TokenPair)(nil), errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewAuthHandler(mockService)

			tt.setupMock(mockService, tt.requestBody)

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
			c.Request = httptest.NewRequest("POST", "/auth/login", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")

			handler.Login(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.LoginResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockTokens.AccessToken, response.AccessToken)
				assert.Equal(t, tt.mockTokens.RefreshToken, response.RefreshToken)
				assert.Equal(t, tt.mockTokens.ExpiresIn, response.ExpiresIn)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Bad Request", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Unauthorized", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_RefreshToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		requestBody    interface{}
		mockTokens     *domain.TokenPair
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockAuthService, requestBody interface{})
	}{
		{
			name: "success",
			requestBody: domain.RefreshRequest{
				RefreshToken: "valid_refresh_token",
			},
			mockTokens: &domain.TokenPair{
				AccessToken:  "new_access_token",
				RefreshToken: "new_refresh_token",
				ExpiresIn:    3600,
			},
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RefreshRequest)
				mockService.On("RefreshToken", mock.Anything, req.RefreshToken).Return(&domain.TokenPair{
					AccessToken:  "new_access_token",
					RefreshToken: "new_refresh_token",
					ExpiresIn:    3600,
				}, nil)
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockTokens:     nil,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "empty refresh token",
			requestBody: domain.RefreshRequest{
				RefreshToken: "",
			},
			mockTokens:     nil,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "invalid token",
			requestBody: domain.RefreshRequest{
				RefreshToken: "invalid_token",
			},
			mockTokens:     nil,
			mockError:      errors.New("invalid token"),
			expectedStatus: http.StatusUnauthorized,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RefreshRequest)
				mockService.On("RefreshToken", mock.Anything, req.RefreshToken).Return((*domain.TokenPair)(nil), errors.New("invalid token"))
			},
		},
		{
			name: "expired token",
			requestBody: domain.RefreshRequest{
				RefreshToken: "expired_token",
			},
			mockTokens:     nil,
			mockError:      errors.New("expired token"),
			expectedStatus: http.StatusUnauthorized,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RefreshRequest)
				mockService.On("RefreshToken", mock.Anything, req.RefreshToken).Return((*domain.TokenPair)(nil), errors.New("expired token"))
			},
		},
		{
			name: "empty token error",
			requestBody: domain.RefreshRequest{
				RefreshToken: "empty_token",
			},
			mockTokens:     nil,
			mockError:      errors.New("empty token"),
			expectedStatus: http.StatusBadRequest,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RefreshRequest)
				mockService.On("RefreshToken", mock.Anything, req.RefreshToken).Return((*domain.TokenPair)(nil), errors.New("empty token"))
			},
		},
		{
			name: "generic service error",
			requestBody: domain.RefreshRequest{
				RefreshToken: "some_token",
			},
			mockTokens:     nil,
			mockError:      errors.New("generic error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.RefreshRequest)
				mockService.On("RefreshToken", mock.Anything, req.RefreshToken).Return((*domain.TokenPair)(nil), errors.New("generic error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewAuthHandler(mockService)

			tt.setupMock(mockService, tt.requestBody)

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
			c.Request = httptest.NewRequest("POST", "/auth/refresh", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")

			handler.RefreshToken(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.RefreshResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockTokens.AccessToken, response.AccessToken)
				assert.Equal(t, tt.mockTokens.RefreshToken, response.RefreshToken)
				assert.Equal(t, tt.mockTokens.ExpiresIn, response.ExpiresIn)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Bad Request", response.Error)
			} else if tt.expectedStatus == http.StatusUnauthorized {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Unauthorized", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Internal Server Error", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_Logout(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		requestBody    interface{}
		mockSuccess    bool
		mockError      error
		expectedStatus int
		setupMock      func(mockService *MockAuthService, requestBody interface{})
	}{
		{
			name: "success",
			requestBody: domain.LogoutRequest{
				RefreshToken: "valid_refresh_token",
			},
			mockSuccess:    true,
			mockError:      nil,
			expectedStatus: http.StatusOK,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.LogoutRequest)
				mockService.On("Logout", mock.Anything, req.RefreshToken).Return(true, nil)
			},
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "empty refresh token",
			requestBody: domain.LogoutRequest{
				RefreshToken: "",
			},
			mockSuccess:    false,
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
			setupMock:      func(mockService *MockAuthService, requestBody interface{}) {},
		},
		{
			name: "service error",
			requestBody: domain.LogoutRequest{
				RefreshToken: "valid_refresh_token",
			},
			mockSuccess:    false,
			mockError:      errors.New("service error"),
			expectedStatus: http.StatusInternalServerError,
			setupMock: func(mockService *MockAuthService, requestBody interface{}) {
				req := requestBody.(domain.LogoutRequest)
				mockService.On("Logout", mock.Anything, req.RefreshToken).Return(false, errors.New("service error"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewAuthHandler(mockService)

			tt.setupMock(mockService, tt.requestBody)

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
			c.Request = httptest.NewRequest("POST", "/auth/logout", strings.NewReader(requestBody))
			c.Request.Header.Set("Content-Type", "application/json")

			handler.Logout(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response domain.LogoutResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockSuccess, response.Success)
			} else if tt.expectedStatus == http.StatusBadRequest {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Bad Request", response.Error)
			} else if tt.expectedStatus == http.StatusInternalServerError {
				var response utils.ErrorResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Internal Server Error", response.Error)
			}

			mockService.AssertExpectations(t)
		})
	}
}