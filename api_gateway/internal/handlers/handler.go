package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/handlers/websocket"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/middleware"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Handlers struct {
	WebSocket websocket.WebSocketHandler
	UserHandler UserHandler
	AuthHandler AuthHandler
	ChatHandler ChatHandler
}

func NewHandler(websocketHandler websocket.WebSocketHandler, userHandler UserHandler, authHandler AuthHandler, chatHandler ChatHandler) *Handlers{
	return &Handlers{
		WebSocket: websocketHandler,
		UserHandler: userHandler,
		AuthHandler: authHandler,
		ChatHandler: chatHandler,
	}
}

func InitRoutes(handlers Handlers) *gin.Engine {
	router := gin.Default()

	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Mentor Platform API Gateway",
			"version": "1.0",
			"docs":    "/swagger/index.html",
			"health":  "/health",
		})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "OK",
			"service": "api_gateway",
		})
	})

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := router.Group("/api/v1")
	{
		// Public endpoints
		public := api.Group("")
		{
			// Authentication
			auth := public.Group("/auth")
			{
				auth.POST("/register", handlers.AuthHandler.Register)
				auth.POST("/login", handlers.AuthHandler.Login)
				auth.POST("/refresh", handlers.AuthHandler.RefreshToken)
				auth.POST("/logout", handlers.AuthHandler.Logout)
			}
		}

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{

			protected.GET("/ws", handlers.WebSocket.HandleWebSocket)

			users := protected.Group("/users")
			{
				users.GET("/:id", handlers.UserHandler.GetUserByID)
				users.GET("/email/:email", handlers.UserHandler.GetUserByEmail)
				users.DELETE("/:id", handlers.UserHandler.DeleteUser)
			}

			profiles := protected.Group("/profiles")
			{
				profiles.GET("/:id", handlers.UserHandler.GetProfile)
				profiles.PUT("/:id", handlers.UserHandler.UpdateProfile)
			}

			chats := protected.Group("/chats")
			{
				chats.POST("/", handlers.ChatHandler.CreateChat)
				chats.GET("/", handlers.ChatHandler.GetUserChats)
				chats.GET("/:id", handlers.ChatHandler.GetChatById)
				chats.GET("/messages", handlers.ChatHandler.GetChatMessages)
				chats.POST("/messages/read", handlers.ChatHandler.MarkMessagesRead)
			}
		}
	}
	
	return router
}
