package domain

const (
	SlotStatusAvailable = "available"
	SlotStatusBooked    = "booked"
	SlotStatusClosed    = "closed"

	PaymentStatusPending   = "pending"
	PaymentStatusPaid      = "paid"
	PaymentStatusCancelled = "cancelled"
)

// Валидаторы
var (
	ValidSlotStatuses = map[string]bool{
		SlotStatusAvailable: true,
		SlotStatusBooked:    true,
		SlotStatusClosed:    true,
	}

	ValidPaymentStatuses = map[string]bool{
		PaymentStatusPending:   true,
		PaymentStatusPaid:      true,
		PaymentStatusCancelled: true,
	}
)