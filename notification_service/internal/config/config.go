package config

import (
	"fmt"
	"os"

	env "github.com/caarlos0/env/v11"
	"gopkg.in/yaml.v3"
)

type Config struct {
	DBConfig     `yaml:"db"`
	GmailConfig  `yaml:"gmail"`  
}

type GmailConfig struct {
	Email    string `env:"GMAIL_EMAIL,required"`
	Password string `env:"GMAIL_APP_PASSWORD,required"`
	FromName string `env:"GMAIL_FROM_NAME" envDefault:"Mentor Platform"`
}

type DBConfig struct {
	Port     string `env:"DB_PORT" yaml:"port" envDefault:"5432"`
	Host     string `env:"DB_HOST" yaml:"host" envDefault:"localhost"`
	DBName   string `env:"DB_NAME" yaml:"db_name" envDefault:"notifications"`
	Password string `env:"DB_PASSWORD,required" yaml:"-"`
	Username string `env:"DB_USERNAME" yaml:"username" envDefault:"mentors"`
	SSLMode  string `env:"DB_SSL_MODE" yaml:"ssl_mode" envDefault:"disable"`
}

func InitConfig(configPath string) (*Config, error) {
	var cfg Config

	// Сначала загружаем из YAML если файл существует
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("failed to unmarshal YAML config: %w", err)
		}
	}

	// Затем парсим env переменные (перезаписывают YAML значения)
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse environment variables: %w", err)
	}

	return &cfg, nil
}

func GetConfigPath() string {
	if _, err := os.Stat("./config/config.yaml"); err == nil {
		return "./config/config.yaml"  
	}
	return "/home/appuser/config/config.yaml"
}