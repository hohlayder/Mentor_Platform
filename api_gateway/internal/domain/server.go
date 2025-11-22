package domain

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Server struct {
	httpServer *http.Server
}

//позде данные будут браться из конфига
func NewServer(router *gin.Engine) *Server{
	return &Server{
		httpServer: &http.Server{
			Addr:         ":" + "8080",
			Handler:      router,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}
}

func (s *Server) Start() error {
	return  s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
	defer cancel()
	
	return s.httpServer.Shutdown(ctx)
}