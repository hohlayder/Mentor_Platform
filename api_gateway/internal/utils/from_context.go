package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetUserIdFromContext(c *gin.Context) (string, bool) {
	userId, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "UNAUTHORIZED_ERROR",
			Message: "User is unauthorized",
		})
		return "", false
	}

	userIdStr, ok := userId.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "UNAUTHORIZED_ERROR",
			Message: "User is unauthorized",
		})
		return "", false
	}

	return userIdStr, true
}