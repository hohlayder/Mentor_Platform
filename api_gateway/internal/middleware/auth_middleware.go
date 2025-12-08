package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type CustomClaims struct {
	UserId string `json:"UserId"`
	jwt.RegisteredClaims
	TokenType string `json:"type"`
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithError(http.StatusUnauthorized, errors.New("no auth header"))
			return
		}

		headerParts := strings.Split(header, " ")
		if len(headerParts) != 2 {
			c.AbortWithError(http.StatusUnauthorized, errors.New("bad auth header"))
			return
		}

		claims, err := ParseToken(headerParts[1])
		if err != nil {
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}
		
		c.Set("user_id", claims.UserId)
		
		c.Next()
	}
}

func ParseToken(tokenString string) (*CustomClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return []byte(os.Getenv("JWT_SECRET")), nil
    })

    if err != nil {
        return nil, err
    }

    if claims, ok := token.Claims.(*CustomClaims); ok && token.Valid {
        return claims, nil
    }

    return nil, errors.New("invalid token")
}
