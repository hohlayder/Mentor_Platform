package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DBConfig `yaml:"db"`
}

type DBConfig struct {
	Port     string `yaml:"port"`
	Host     string `yaml:"host"`
	DBName   string `yaml:"db_name"`
	Password string `yaml:"-"`
	Username string `yaml:"username"`
	SSLMode  string `yaml:"ssl_mode"`
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

	cfg.DBConfig.Password = os.Getenv("DB_PASSWORD")
	return &cfg, nil
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