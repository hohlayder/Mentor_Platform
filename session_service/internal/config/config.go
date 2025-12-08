package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DBConfig    `yaml:"db"`
	TokenConfig `yaml:"token"`
}

type DBConfig struct {
	Port     string `yaml:"port"`
	Host     string `yaml:"host"`
	DBName   string `yaml:"db_name"`
	Password string `yaml:"-"`
	Username string `yaml:"username"`
	SSLMode  string `yaml:"ssl_mode"`
}

type TokenConfig struct {
	AccessSecret  string        `yaml:"-"`
	AccessExpiry  time.Duration `yaml:"access_expiry"`
	RefreshExpiry time.Duration `yaml:"refresh_expiry"`
}

func InitConfig(configPath string) (*Config, error) {
	var cfg Config
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config path not found")
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to read data to config: %w", err)
	}

	if cfg.DBConfig.Password = os.Getenv("DB_PASSWORD"); cfg.DBConfig.Password == "" {
		return nil, fmt.Errorf("DB_PASSWORD environment variable is required")
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}
	
	return &cfg, nil
}

func (c *Config) Validate() error {
	if err := c.DBConfig.Validate(); err != nil {
		return fmt.Errorf("db config: %w", err)
	}

	return nil
}

func (db *DBConfig) Validate() error {
	if db.Host == "" {
		return fmt.Errorf("host is required")
	}
	if db.Port == "" {
		return fmt.Errorf("port is required")
	}
	if db.DBName == "" {
		return fmt.Errorf("database name is required")
	}
	if db.Username == "" {
		return fmt.Errorf("username is required")
	}
	if db.Password == "" {
		return fmt.Errorf("password is required")
	}
	if db.SSLMode == "" {
		return fmt.Errorf("ssl mode is required")
	}
	
	return nil
}


func GetConfigPath() string {
	var configPath string
	if _, err := os.Stat("./config/config.yaml"); err == nil {
		configPath = "./config/config.yaml"  
	} else {
		configPath = "/home/appuser/config/config.yaml"  
	}
    return configPath
}