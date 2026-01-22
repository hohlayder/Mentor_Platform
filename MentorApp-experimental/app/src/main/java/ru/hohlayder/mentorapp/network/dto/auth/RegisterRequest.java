package ru.hohlayder.mentorapp.network.dto;

public class RegisterRequest {
    public String name;
    public String surname;
    public String email;
    public String password;

    public RegisterRequest(String name, String surname, String email, String password) {
        this.name = name;
        this.surname = surname;
        this.email = email;
        this.password = password;
    }
}
