package ru.hohlayder.mentorapp.network.dto.slot;

public class UpdateSlotStatusRequest {
    public String status;

    public UpdateSlotStatusRequest(String status) {
        this.status = status;
    }
}