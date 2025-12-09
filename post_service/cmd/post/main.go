package main

import (
	"fmt"
	"log"
	"net"
	"os"

	postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"github.com/hohlayder/Mentor_Platform/post_service/internal/repository"
	"github.com/hohlayder/Mentor_Platform/post_service/internal/service"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5434")
	dbName := getEnv("DB_NAME", "post_service_db")
	dbUser := getEnv("DB_USER", "post_service")
	dbPassword := getEnv("DB_PASSWORD", "post_service")

	grpcPort := getEnv("GRPC_PORT", "50056")

	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser,
		dbPassword,
		dbHost,
		dbPort,
		dbName,
	)

	db, err := sqlx.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("failed to open postgres connection: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping postgres: %v", err)
	}

	log.Printf("Connected to Postgres %s on %s:%s", dbName, dbHost, dbPort)

	postRepo := repository.NewPostRepository(db)
	ratingRepo := repository.NewRatingRepository(db)
	postService := service.NewPostService(postRepo, ratingRepo)

	addr := ":" + grpcPort

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}

	grpcServer := grpc.NewServer()
	postsv1.RegisterPostServiceServer(grpcServer, postService)

	log.Printf("PostService gRPC server is listening on %s", addr)

	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve gRPC server: %v", err)
	}
}
