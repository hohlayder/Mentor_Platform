package validators

import (
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

func RegisterValidators() {
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterValidation("slotstatus", func(fl validator.FieldLevel) bool {
			status, ok := fl.Field().Interface().(string)
			if !ok {
				return false
			}
			return domain.ValidSlotStatuses[status]
		})

		v.RegisterValidation("paymentstatus", func(fl validator.FieldLevel) bool {
			status, ok := fl.Field().Interface().(string)
			if !ok {
				return false
			}
			return domain.ValidPaymentStatuses[status]
		})
	}
}