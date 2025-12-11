package postgres

import (
	"fmt"

	"github.com/hohlayder/Mentor_Platform/notification_service/internal/config"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func NewPostgresRepository(cfg config.Config) (*sqlx.DB, error){
	connStr := fmt.Sprintf(`port=%s host=%s user=%s dbname=%s password=%s sslmode=%s`,
							cfg.Port, cfg.Host, cfg.Username, cfg.DBName, cfg.DBConfig.Password, cfg.SSLMode)
	db, err := sqlx.Connect("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to Ping to database: %w", err)
	}

	return db, nil
}