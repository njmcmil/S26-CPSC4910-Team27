# schemas/user.py
from pydantic import BaseModel, EmailStr

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str
    email: EmailStr

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    user_id: int
    username: str
    role: str
    email: str
    access_token: str

class ForgotPasswordRequest(BaseModel):
    username: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
