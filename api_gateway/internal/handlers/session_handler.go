package handlers

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/utils"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SessionService interface {
	CreateSlot(ctx context.Context, req *domain.CreateSlotRequest) (string, error)
	GetSlot(ctx context.Context, slotID string) (*domain.SlotResponse, error)
	UpdateSlot(ctx context.Context, slotID string, req *domain.UpdateSlotRequest) error
	UpdateSlotStatus(ctx context.Context, slotID, status string) error
	DeleteSlot(ctx context.Context, slotID string) error
	
	CreateSession(ctx context.Context, req *domain.CreateSessionRequest) (string, error)
	GetSession(ctx context.Context, sessionID string) (*domain.SessionResponse, error)
	UpdateSession(ctx context.Context, sessionID string, req *domain.UpdateSessionRequest) error
	RateSession(ctx context.Context, sessionID string, req *domain.RateSessionRequest) error
	DeleteSession(ctx context.Context, sessionID string) error
	
	ListSessionsByMentor(ctx context.Context, mentorID string) ([]domain.SessionResponse, error)
	ListSessionsByStudent(ctx context.Context, studentID string) ([]domain.SessionResponse, error)
}

type SessionHandler struct {
	service SessionService
}

func NewSessionHandler(service SessionService) *SessionHandler {
	return &SessionHandler{service: service}
}

func handleServiceError(c *gin.Context, err error, operation string) bool {
	if err == nil {
		return false
	}

	if st, ok := status.FromError(err); ok {
		code := st.Code()
		message := st.Message()
		
		slog.Error("Service error", 
			"operation", operation,
			"code", code.String(),
			"message", message,
		)
		
		switch code {
		case codes.NotFound:
			c.JSON(http.StatusNotFound, utils.ErrorResponse{
				Error:   "NOT_FOUND_ERROR",
				Message: message,
			})
		case codes.InvalidArgument:
			c.JSON(http.StatusBadRequest, utils.ErrorResponse{
				Error:   "VALIDATION_ERROR",
				Message: message,
			})
		case codes.PermissionDenied:
			c.JSON(http.StatusForbidden, utils.ErrorResponse{
				Error:   "FORBIDDEN_ERROR",
				Message: message,
			})
		case codes.FailedPrecondition:
			c.JSON(http.StatusBadRequest, utils.ErrorResponse{
				Error:   "PRECONDITION_ERROR",
				Message: message,
			})
		case codes.AlreadyExists:
			c.JSON(http.StatusConflict, utils.ErrorResponse{
				Error:   "CONFLICT_ERROR",
				Message: message,
			})
		case codes.Unavailable:
			c.JSON(http.StatusServiceUnavailable, utils.ErrorResponse{
				Error:   "SERVICE_UNAVAILABLE",
				Message: "Session service is unavailable",
			})
		default:
			c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
				Error:   "INTERNAL_ERROR",
				Message: "Internal server error",
			})
		}
		return true
	}

	slog.Error("Unexpected error", 
		"operation", operation,
		"error", err.Error(),
	)
	
	c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
		Error:   "INTERNAL_ERROR",
		Message: "Internal server error",
	})
	return true
}

// CreateSlot создает новый временной слот для ментора
// @Summary Создать слот
// @Description Создает новый временной слот для ментора
// @Tags slots
// @Accept json
// @Produce json
// @Param request body domain.CreateSlotRequest true "Данные для создания слота"
// @Security BearerAuth
// @Success 201 {object} map[string]interface{} "slot_id и success"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа"
// @Failure 404 {object} utils.ErrorResponse "Ресурс не найден"
// @Failure 409 {object} utils.ErrorResponse "Конфликт (уже существует)"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /slots [post]
func (h *SessionHandler) CreateSlot(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	var req domain.CreateSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	if req.MentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only create slots for yourself",
		})
		return
	}

	slotID, err := h.service.CreateSlot(c.Request.Context(), &req)
	if err != nil {
		if handleServiceError(c, err, "create slot") {
			return
		}

		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to create slot",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"slot_id": slotID,
		"success": true,
	})
}

// GetSlot получает информацию о временном слоте
// @Summary Получить информацию о слоте
// @Description Возвращает детальную информацию о временном слоте по ID
// @Tags slots
// @Accept json
// @Produce json
// @Param id path string true "ID слота (UUID)"
// @Security BearerAuth
// @Success 200 {object} domain.SlotResponse "Информация о слоте"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID слота"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 404 {object} utils.ErrorResponse "Слот не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /slots/{id} [get]
func (h *SessionHandler) GetSlot(c *gin.Context) {
	slotID := c.Param("id")
	if slotID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Slot ID is required",
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), slotID)
	if err != nil {
		if handleServiceError(c, err, "get slot") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get slot",
		})
		return
	}

	c.JSON(http.StatusOK, slot)
}

// UpdateSlot обновляет информацию о временном слоте
// @Summary Обновить слот
// @Description Обновляет информацию о существующем временном слоте. Только владелец слота может его обновить.
// @Tags slots
// @Accept json
// @Produce json
// @Param id path string true "ID слота (UUID)"
// @Param request body domain.UpdateSlotRequest true "Данные для обновления"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешное обновление"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не владелец)"
// @Failure 404 {object} utils.ErrorResponse "Слот не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /slots/{id} [put]
func (h *SessionHandler) UpdateSlot(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	slotID := c.Param("id")
	if slotID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Slot ID is required",
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), slotID)
	if err != nil {
		if handleServiceError(c, err, "get slot for ownership check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot ownership",
		})
		return
	}

	if slot.MentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only update your own slots",
		})
		return
	}

	var req domain.UpdateSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	err = h.service.UpdateSlot(c.Request.Context(), slotID, &req)
	if err != nil {
		if handleServiceError(c, err, "update slot") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to update slot",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// UpdateSlotStatus обновляет статус временного слота
// @Summary Обновить статус слота
// @Description Обновляет статус существующего временного слота. Допустимые статусы: "available", "booked", "closed". Только владелец слота может изменить статус.
// @Tags slots
// @Accept json
// @Produce json
// @Param id path string true "ID слота (UUID)"
// @Param request body domain.UpdateSlotStatusRequest true "Новый статус"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешное обновление статуса"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные или недопустимый статус"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не владелец)"
// @Failure 404 {object} utils.ErrorResponse "Слот не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /slots/{id}/status [patch]
func (h *SessionHandler) UpdateSlotStatus(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	slotID := c.Param("id")
	if slotID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Slot ID is required",
		})
		return
	}

	var req domain.UpdateSlotStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), slotID)
	if err != nil {
		if handleServiceError(c, err, "get slot for ownership check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot ownership",
		})
		return
	}

	if slot.MentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only update status of your own slots",
		})
		return
	}

	err = h.service.UpdateSlotStatus(c.Request.Context(), slotID, req.Status)
	if err != nil {
		if handleServiceError(c, err, "update slot status") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to update slot status",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// DeleteSlot удаляет временной слот
// @Summary Удалить слот
// @Description Удаляет существующий временной слот. Только владелец слота может его удалить.
// @Tags slots
// @Accept json
// @Produce json
// @Param id path string true "ID слота (UUID)"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешное удаление"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID слота"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не владелец)"
// @Failure 404 {object} utils.ErrorResponse "Слот не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /slots/{id} [delete]
func (h *SessionHandler) DeleteSlot(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	slotID := c.Param("id")
	if slotID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Slot ID is required",
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), slotID)
	if err != nil {
		if handleServiceError(c, err, "get slot for ownership check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot ownership",
		})
		return
	}

	if slot.MentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only delete your own slots",
		})
		return
	}

	err = h.service.DeleteSlot(c.Request.Context(), slotID)
	if err != nil {
		if handleServiceError(c, err, "delete slot") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to delete slot",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// CreateSession создает новую сессию (бронирование слота)
// @Summary Создать сессию
// @Description Создает новую сессию (бронирование временного слота студентом). Студент может создавать сессии только для себя.
// @Tags sessions
// @Accept json
// @Produce json
// @Param request body domain.CreateSessionRequest true "Данные для создания сессии"
// @Security BearerAuth
// @Success 201 {object} map[string]interface{} "session_id и success"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не студент или слот недоступен)"
// @Failure 404 {object} utils.ErrorResponse "Слот не найден"
// @Failure 409 {object} utils.ErrorResponse "Конфликт (сессия уже существует)"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /sessions [post]
func (h *SessionHandler) CreateSession(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	var req domain.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	if req.StudentID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only create sessions for yourself",
		})
		return
	}

	_, err := h.service.GetSlot(c.Request.Context(), req.SlotID)
	if err != nil {
		if handleServiceError(c, err, "check slot existence") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot",
		})
		return
	}

	sessionID, err := h.service.CreateSession(c.Request.Context(), &req)
	if err != nil {
		if handleServiceError(c, err, "create session") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to create session",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"session_id": sessionID,
		"success":    true,
	})
}

// GetSession получает информацию о сессии
// @Summary Получить информацию о сессии
// @Description Возвращает детальную информацию о сессии по ID
// @Tags sessions
// @Accept json
// @Produce json
// @Param id path string true "ID сессии (UUID)"
// @Security BearerAuth
// @Success 200 {object} domain.SessionResponse "Информация о сессии"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID сессии"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 404 {object} utils.ErrorResponse "Сессия не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /sessions/{id} [get]
func (h *SessionHandler) GetSession(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Session ID is required",
		})
		return
	}

	session, err := h.service.GetSession(c.Request.Context(), sessionID)
	if err != nil {
		if handleServiceError(c, err, "get session") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get session",
		})
		return
	}

	c.JSON(http.StatusOK, session)
}

// UpdateSession обновляет информацию о сессии
// @Summary Обновить сессию
// @Description Обновляет информацию о существующей сессии. Доступ имеют: ментор слота ИЛИ студент сессии.
// @Tags sessions
// @Accept json
// @Produce json
// @Param id path string true "ID сессии (UUID)"
// @Param request body domain.UpdateSessionRequest true "Данные для обновления"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешное обновление"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа"
// @Failure 404 {object} utils.ErrorResponse "Сессия не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /sessions/{id} [put]
func (h *SessionHandler) UpdateSession(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Session ID is required",
		})
		return
	}

	session, err := h.service.GetSession(c.Request.Context(), sessionID)
	if err != nil {
		if handleServiceError(c, err, "get session for permission check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check session permissions",
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), session.SlotID)
	if err != nil {
		if handleServiceError(c, err, "get slot for permission check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot permissions",
		})
		return
	}

	if slot.MentorID != userId && session.StudentID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You don't have permission to update this session",
		})
		return
	}

	var req domain.UpdateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	err = h.service.UpdateSession(c.Request.Context(), sessionID, &req)
	if err != nil {
		if handleServiceError(c, err, "update session") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to update session",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// RateSession оценивает завершенную сессию
// @Summary Оценить сессию
// @Description Добавляет оценку и отзыв к завершенной и оплаченной сессии. Только студент сессии может оценить свою сессию.
// @Tags sessions
// @Accept json
// @Produce json
// @Param id path string true "ID сессии (UUID)"
// @Param request body domain.RateSessionRequest true "Оценка (1-5) и отзыв"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешная оценка"
// @Failure 400 {object} utils.ErrorResponse "Неверные входные данные (оценка вне диапазона 1-5)"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа"
// @Failure 404 {object} utils.ErrorResponse "Сессия не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /sessions/{id}/rate [post]
func (h *SessionHandler) RateSession(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Session ID is required",
		})
		return
	}

	var req domain.RateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Invalid input data",
			Details: err.Error(),
		})
		return
	}

	session, err := h.service.GetSession(c.Request.Context(), sessionID)
	if err != nil {
		if handleServiceError(c, err, "get session for rating") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to get session for rating",
		})
		return
	}

	if session.StudentID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only rate your own sessions",
		})
		return
	}

	if session.PaymentStatus != "paid" {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only rate paid sessions",
		})
		return
	}

	err = h.service.RateSession(c.Request.Context(), sessionID, &req)
	if err != nil {
		if handleServiceError(c, err, "rate session") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to rate session",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// DeleteSession удаляет сессию
// @Summary Удалить сессию
// @Description Удаляет существующую сессию. Только ментор слота может удалить сессию.
// @Tags sessions
// @Accept json
// @Produce json
// @Param id path string true "ID сессии (UUID)"
// @Security BearerAuth
// @Success 200 {object} utils.SuccessResponse "Успешное удаление"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID сессии"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа"
// @Failure 404 {object} utils.ErrorResponse "Сессия не найден"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /sessions/{id} [delete]
func (h *SessionHandler) DeleteSession(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Session ID is required",
		})
		return
	}

	session, err := h.service.GetSession(c.Request.Context(), sessionID)
	if err != nil {
		if handleServiceError(c, err, "get session for permission check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check session permissions",
		})
		return
	}

	slot, err := h.service.GetSlot(c.Request.Context(), session.SlotID)
	if err != nil {
		if handleServiceError(c, err, "get slot for permission check") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to check slot permissions",
		})
		return
	}

	if slot.MentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "Only the mentor can delete a session",
		})
		return
	}

	err = h.service.DeleteSession(c.Request.Context(), sessionID)
	if err != nil {
		if handleServiceError(c, err, "delete session") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to delete session",
		})
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse{Success: true})
}

// ListSessionsByMentor получает список сессий ментора
// @Summary Список сессий ментора
// @Description Возвращает список всех сессий для конкретного ментора. Только сам ментор может просматривать свои сессии.
// @Tags sessions
// @Accept json
// @Produce json
// @Param mentor_id path string true "ID ментора (UUID)"
// @Security BearerAuth
// @Success 200 {object} domain.ListSessionsResponse "Список сессий и общее количество"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID ментора"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не тот ментор)"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /mentors/{mentor_id}/sessions [get]
func (h *SessionHandler) ListSessionsByMentor(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	mentorID := c.Param("mentor_id")
	if mentorID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Mentor ID is required",
		})
		return
	}

	if mentorID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only view your own sessions",
		})
		return
	}

	sessions, err := h.service.ListSessionsByMentor(c.Request.Context(), mentorID)
	if err != nil {
		if handleServiceError(c, err, "list sessions by mentor") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to list sessions",
		})
		return
	}

	c.JSON(http.StatusOK, domain.ListSessionsResponse{
		Sessions: sessions,
		Total:    int64(len(sessions)),
	})
}

// ListSessionsByStudent получает список сессий студента
// @Summary Список сессий студента
// @Description Возвращает список всех сессий для конкретного студента. Только сам студент может просматривать свои сессии.
// @Tags sessions
// @Accept json
// @Produce json
// @Param student_id path string true "ID студента (UUID)"
// @Security BearerAuth
// @Success 200 {object} domain.ListSessionsResponse "Список сессий и общее количество"
// @Failure 400 {object} utils.ErrorResponse "Неверный ID студента"
// @Failure 401 {object} utils.ErrorResponse "Не авторизован"
// @Failure 403 {object} utils.ErrorResponse "Нет прав доступа (не тот студент)"
// @Failure 500 {object} utils.ErrorResponse "Внутренняя ошибка сервера"
// @Router /students/{student_id}/sessions [get]
func (h *SessionHandler) ListSessionsByStudent(c *gin.Context) {
	userId, ok := utils.GetUserIdFromContext(c)
	if !ok {
		return
	}

	studentID := c.Param("student_id")
	if studentID == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse{
			Error:   "VALIDATION_ERROR",
			Message: "Student ID is required",
		})
		return
	}

	if studentID != userId {
		c.JSON(http.StatusForbidden, utils.ErrorResponse{
			Error:   "FORBIDDEN_ERROR",
			Message: "You can only view your own sessions",
		})
		return
	}

	sessions, err := h.service.ListSessionsByStudent(c.Request.Context(), studentID)
	if err != nil {
		if handleServiceError(c, err, "list sessions by student") {
			return
		}
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Message: "Failed to list sessions",
		})
		return
	}

	c.JSON(http.StatusOK, domain.ListSessionsResponse{
		Sessions: sessions,
		Total:    int64(len(sessions)),
	})
}