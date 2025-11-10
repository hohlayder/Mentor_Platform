package grpc

import (
	"context"
	"errors"
	"testing"

	authv1 "github.com/Sergey-1214/contracts_mentors/auth/v1"
	jwt "github.com/hohlayder/Mentor_Platform/auth_service/internal/auth/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Mock AuthService
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Register(ctx context.Context, name string, surname string, email string, password string) (string, error) {
	args := m.Called(ctx, name, surname, email, password)
	return args.String(0), args.Error(1)
}

func (m *MockAuthService) Login(ctx context.Context, email string, password string) (*jwt.TokenPair, error) {
	args := m.Called(ctx, email, password)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jwt.TokenPair), args.Error(1)
}

func (m *MockAuthService) RefreshToken(ctx context.Context, refreshToken string) (*jwt.TokenPair, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jwt.TokenPair), args.Error(1)
}

func (m *MockAuthService) Logout(ctx context.Context, refreshToken string) error {
	args := m.Called(ctx, refreshToken)
	return args.Error(0)
}

func TestNewGRPCHandler(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewGRPCHandler(mockService)

	assert.NotNil(t, handler)
	assert.Equal(t, mockService, handler.service)
}

func TestGRPCHandler_Register(t *testing.T) {
	tests := []struct {
		name           string
		request        *authv1.RegisterRequest
		setupMock      func(*MockAuthService)
		expectedResponse *authv1.RegisterResponse
		expectedError  bool
		expectedCode   codes.Code
	}{
		{
			name: "successful registration",
			request: &authv1.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "john@example.com",
				Password: "password123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Register", mock.Anything, "John", "Doe", "john@example.com", "password123").
					Return("user123", nil)
			},
			expectedResponse: &authv1.RegisterResponse{
				Id: "user123",
			},
			expectedError: false,
		},
		{
			name: "registration fails",
			request: &authv1.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "john@example.com",
				Password: "password123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Register", mock.Anything, "John", "Doe", "john@example.com", "password123").
					Return("", errors.New("service error"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
		{
			name: "empty email",
			request: &authv1.RegisterRequest{
				Name:     "John",
				Surname:  "Doe",
				Email:    "",
				Password: "password123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Register", mock.Anything, "John", "Doe", "", "password123").
					Return("", errors.New("validation error"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewGRPCHandler(mockService)
			tt.setupMock(mockService)

			ctx := context.Background()
			resp, err := handler.Register(ctx, tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				grpcStatus, ok := status.FromError(err)
				assert.True(t, ok)
				assert.Equal(t, tt.expectedCode, grpcStatus.Code())
				assert.Nil(t, resp)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResponse, resp)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestGRPCHandler_Login(t *testing.T) {
	tests := []struct {
		name           string
		request        *authv1.LoginRequest
		setupMock      func(*MockAuthService)
		expectedResponse *authv1.LoginResponse
		expectedError  bool
		expectedCode   codes.Code
	}{
		{
			name: "successful login",
			request: &authv1.LoginRequest{
				Email:    "john@example.com",
				Password: "password123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Login", mock.Anything, "john@example.com", "password123").
					Return(&jwt.TokenPair{
						AccessToken:  "access_token_123",
						RefreshToken: "refresh_token_123",
						ExpiresIn:    3600,
					}, nil)
			},
			expectedResponse: &authv1.LoginResponse{
				AccessToken:  "access_token_123",
				RefreshToken: "refresh_token_123",
				ExpiresIn:    3600,
			},
			expectedError: false,
		},
		{
			name: "login fails - invalid credentials",
			request: &authv1.LoginRequest{
				Email:    "john@example.com",
				Password: "wrongpassword",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Login", mock.Anything, "john@example.com", "wrongpassword").
					Return(nil, errors.New("invalid credentials"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
		{
			name: "login fails - user not found",
			request: &authv1.LoginRequest{
				Email:    "nonexistent@example.com",
				Password: "password123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Login", mock.Anything, "nonexistent@example.com", "password123").
					Return(nil, errors.New("user not found"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
		{
			name: "empty credentials",
			request: &authv1.LoginRequest{
				Email:    "",
				Password: "",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Login", mock.Anything, "", "").
					Return(nil, errors.New("validation error"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewGRPCHandler(mockService)
			tt.setupMock(mockService)

			ctx := context.Background()
			resp, err := handler.Login(ctx, tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				grpcStatus, ok := status.FromError(err)
				assert.True(t, ok)
				assert.Equal(t, tt.expectedCode, grpcStatus.Code())
				assert.Nil(t, resp)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResponse, resp)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestGRPCHandler_RefreshToken(t *testing.T) {
    var (
        ErrInvalidToken = errors.New("invalid refresh token")
        ErrExpiredToken = errors.New("token expired")
        ErrEmptyToken   = errors.New("empty token")
        ErrUnknown      = errors.New("unknown error")
    )

    tests := []struct {
        name            string
        request         *authv1.RefreshRequest
        setupMock       func(*MockAuthService)
        expectedResponse *authv1.RefreshResponse
        expectedError   bool
        expectedCode    codes.Code
        expectedMessage string
    }{
        {
            name: "successful token refresh",
            request: &authv1.RefreshRequest{
                RefreshToken: "valid_refresh_token",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "valid_refresh_token").
                    Return(&jwt.TokenPair{
                        AccessToken:  "new_access_token",
                        RefreshToken: "new_refresh_token",
                        ExpiresIn:    3600,
                    }, nil)
            },
            expectedResponse: &authv1.RefreshResponse{
                AccessToken:  "new_access_token",
                RefreshToken: "new_refresh_token",
                ExpiresIn:    3600,
            },
            expectedError: false,
        },
        {
            name: "invalid token error",
            request: &authv1.RefreshRequest{
                RefreshToken: "invalid_token",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "invalid_token").
                    Return(nil, ErrInvalidToken)
            },
            expectedResponse: nil,
            expectedError:    true,
            expectedCode:     codes.Unauthenticated,
            expectedMessage:  "invalid token",
        },
        {
            name: "expired token error",
            request: &authv1.RefreshRequest{
                RefreshToken: "expired_token",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "expired_token").
                    Return(nil, ErrExpiredToken)
            },
            expectedResponse: nil,
            expectedError:    true,
            expectedCode:     codes.Unauthenticated,
            expectedMessage:  "token expired",
        },
        {
            name: "empty token error",
            request: &authv1.RefreshRequest{
                RefreshToken: "",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "").
                    Return(nil, ErrEmptyToken)
            },
            expectedResponse: nil,
            expectedError:    true,
            expectedCode:     codes.InvalidArgument,
            expectedMessage:  "empty token",
        },
        {
            name: "unknown error from service",
            request: &authv1.RefreshRequest{
                RefreshToken: "some_token",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "some_token").
                    Return(nil, ErrUnknown)
            },
            expectedResponse: nil,
            expectedError:    true,
            expectedCode:     codes.Internal,
            expectedMessage:  "failed to refresh token",
        },
        {
            name: "service returns nil tokens with error",
            request: &authv1.RefreshRequest{
                RefreshToken: "error_token",
            },
            setupMock: func(m *MockAuthService) {
                m.On("RefreshToken", mock.Anything, "error_token").
                    Return(nil, errors.New("some database error"))
            },
            expectedResponse: nil,
            expectedError:    true,
            expectedCode:     codes.Internal,
            expectedMessage:  "failed to refresh token",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            mockService := new(MockAuthService)
            handler := NewGRPCHandler(mockService)
            tt.setupMock(mockService)

            ctx := context.Background()
            resp, err := handler.Refresh(ctx, tt.request)

            if tt.expectedError {
                assert.Error(t, err)

                grpcStatus, ok := status.FromError(err)
                assert.True(t, ok, "error should be a gRPC status error")
                assert.Equal(t, tt.expectedCode, grpcStatus.Code())
                
                if tt.expectedMessage != "" {
                    assert.Contains(t, grpcStatus.Message(), tt.expectedMessage)
                }
                
                assert.Nil(t, resp)
            } else {
                assert.NoError(t, err)
                assert.Equal(t, tt.expectedResponse, resp)
            }

            mockService.AssertExpectations(t)
        })
    }
}

func TestGRPCHandler_Logout(t *testing.T) {
	tests := []struct {
		name           string
		request        *authv1.LogoutRequest
		setupMock      func(*MockAuthService)
		expectedResponse *authv1.LogoutResponse
		expectedError  bool
		expectedCode   codes.Code
	}{
		{
			name: "successful logout",
			request: &authv1.LogoutRequest{
				RefreshToken: "refresh_token_123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Logout", mock.Anything, "refresh_token_123").
					Return(nil)
			},
			expectedResponse: &authv1.LogoutResponse{
				Success: true,
			},
			expectedError: false,
		},
		{
			name: "logout fails",
			request: &authv1.LogoutRequest{
				RefreshToken: "refresh_token_123",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Logout", mock.Anything, "refresh_token_123").
					Return(errors.New("logout failed"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
		{
			name: "logout with empty token",
			request: &authv1.LogoutRequest{
				RefreshToken: "",
			},
			setupMock: func(m *MockAuthService) {
				m.On("Logout", mock.Anything, "").
					Return(errors.New("empty token"))
			},
			expectedResponse: nil,
			expectedError:    true,
			expectedCode:     codes.Internal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockAuthService)
			handler := NewGRPCHandler(mockService)
			tt.setupMock(mockService)

			ctx := context.Background()
			resp, err := handler.Logout(ctx, tt.request)

			if tt.expectedError {
				assert.Error(t, err)
				grpcStatus, ok := status.FromError(err)
				assert.True(t, ok)
				assert.Equal(t, tt.expectedCode, grpcStatus.Code())
				assert.Nil(t, resp)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResponse, resp)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestGRPCHandler_RegisterServer(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewGRPCHandler(mockService)

	assert.NotNil(t, handler)
	
	var server authv1.AuthServiceServer = handler
	assert.NotNil(t, server)
}

func TestGRPCHandler_ErrorMapping(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewGRPCHandler(mockService)

	t.Run("context cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		mockService.On("Login", ctx, "test@example.com", "password").
			Return(nil, context.Canceled)

		resp, err := handler.Login(ctx, &authv1.LoginRequest{
			Email:    "test@example.com",
			Password: "password",
		})

		assert.Error(t, err)
		assert.Nil(t, resp)
		grpcStatus, ok := status.FromError(err)
		assert.True(t, ok)
		assert.Equal(t, codes.Internal, grpcStatus.Code())
	})

	mockService.AssertExpectations(t)
}
