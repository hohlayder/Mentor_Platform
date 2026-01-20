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
	SessionHandler SessionHandler
	PostHandler PostHandler
	FileHandler FileHandler
}

func NewHandler(websocketHandler websocket.WebSocketHandler, userHandler UserHandler, authHandler AuthHandler,
				 chatHandler ChatHandler, sessionHandler SessionHandler, postHandler PostHandler, FileHandler FileHandler) *Handlers{
	return &Handlers{
		WebSocket: websocketHandler,
		UserHandler: userHandler,
		AuthHandler: authHandler,
		ChatHandler: chatHandler,
		SessionHandler: sessionHandler,
		PostHandler: postHandler,
		FileHandler: FileHandler,
	}
}

func InitRoutes(handlers Handlers) *gin.Engine {
	router := gin.Default()
	router.Use(middleware.CORS())

	router.OPTIONS("/*any", func(c *gin.Context) {
        c.Status(204) 
    })
    
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
			public.GET("/ws", handlers.WebSocket.HandleWebSocket)
			// Authentication
			files := public.Group("/files")
			{
				files.GET("/avatar/:filename", handlers.FileHandler.GetAvatar)
				files.GET("/posts/avatar/:filename", handlers.FileHandler.GetPostAvatar)
			}

			auth := public.Group("/auth")
			{
				auth.POST("/register", handlers.AuthHandler.Register)
				auth.POST("/login", handlers.AuthHandler.Login)
				auth.POST("/refresh", handlers.AuthHandler.RefreshToken)
				auth.POST("/logout", handlers.AuthHandler.Logout)
			}

			users := public.Group("/users")
			{
				users.GET("/:id", handlers.UserHandler.GetUserByID)
				users.GET("/email/:email", handlers.UserHandler.GetUserByEmail)
				users.GET("/all", handlers.UserHandler.GetUserCount)
			}
			profiles := public.Group("/profiles")
			{
				profiles.GET("/:id", handlers.UserHandler.GetProfile)
			}
			posts := public.Group("/posts")
			{
				posts.GET("/:id", handlers.PostHandler.GetPost)
				posts.GET("", handlers.PostHandler.ListPosts)
				posts.GET("/:id/ratings", handlers.PostHandler.GetPostRatings)
				posts.GET("/:id/favorite/count", handlers.PostHandler.GetInterestingUsersCount)
			}
			public.GET("/mentors/:mentor_id/slots", handlers.SessionHandler.GetSlotsByMentor)
		}

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			users := protected.Group("/users")
			{
				users.DELETE("/:id", handlers.UserHandler.DeleteUser)
			}

			profiles := protected.Group("/profiles")
			{
				profiles.PUT("/:id", handlers.UserHandler.UpdateProfile)
			}

			chats := protected.Group("/chats")
			{
				chats.POST("", handlers.ChatHandler.CreateChat)
				chats.GET("", handlers.ChatHandler.GetUserChats)
				chats.GET("/:id", handlers.ChatHandler.GetChatById)
				chats.GET("/messages", handlers.ChatHandler.GetChatMessages)
				chats.POST("/messages/read", handlers.ChatHandler.MarkMessagesRead)
			}
			slots := protected.Group("/slots")
			{
				slots.POST("", handlers.SessionHandler.CreateSlot)
				slots.GET("/:id", handlers.SessionHandler.GetSlot)
				slots.PUT("/:id", handlers.SessionHandler.UpdateSlot)
				slots.PATCH("/:id/status", handlers.SessionHandler.UpdateSlotStatus)
				slots.DELETE("/:id", handlers.SessionHandler.DeleteSlot)
			}
			sessions := protected.Group("/sessions")
			{
				sessions.POST("", handlers.SessionHandler.CreateSession)
				sessions.GET("/:id", handlers.SessionHandler.GetSession)
				sessions.PUT("/:id", handlers.SessionHandler.UpdateSession)
				sessions.POST("/:id/rate", handlers.SessionHandler.RateSession)
				sessions.DELETE("/:id", handlers.SessionHandler.DeleteSession)
			}
			posts := protected.Group("/posts")
			{
				posts.POST("", handlers.PostHandler.CreatePost)
				posts.GET("/favorite", handlers.PostHandler.GetFavoritePosts)
				posts.PUT("/:id", handlers.PostHandler.UpdatePost)
				posts.DELETE("/:id", handlers.PostHandler.DeletePost)
				posts.POST("/:id/rate", handlers.PostHandler.RatePost)
				posts.POST("/:id/favorite", handlers.PostHandler.AddToFavorites)
				posts.DELETE("/:id/favorite", handlers.PostHandler.AddToFavorites)
			}
			files := protected.Group("/files")
			{
				files.POST("/posts/avatar/:post_id", handlers.FileHandler.UploadPostAvatar)
				files.DELETE("/posts/avatar/:post_id", handlers.FileHandler.DeletePostAvatar)
				files.POST("/avatar", handlers.FileHandler.UploadAvatar)
				files.DELETE("/avatar", handlers.FileHandler.DeleteAvatar)
			}

			protected.GET("/mentors/:mentor_id/sessions", handlers.SessionHandler.ListSessionsByMentor)
			protected.GET("/mentors/:mentor_id/favorited-by", handlers.PostHandler.GetUsersFavoritedMentorPosts)
			protected.GET("/mentors/:mentor_id/payment-amount", handlers.SessionHandler.GetMentorPaymentAmount)
			protected.GET("/students/:student_id/sessions", handlers.SessionHandler.ListSessionsByStudent)	
		}
	}
	
	return router
}
