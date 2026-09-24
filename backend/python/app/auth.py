from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["Autenticação"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(data: RegisterRequest):
    try:
        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "name": data.name
                }
            }
        })

        if not response.user:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível criar o usuário."
            )

        return {
            "message": "Usuário criado com sucesso.",
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "name": data.name
            },
            "session": response.session
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.post("/login")
def login(data: LoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        if not response.user or not response.session:
            raise HTTPException(
                status_code=401,
                detail="E-mail ou senha inválidos."
            )

        return {
            "message": "Login realizado com sucesso.",
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=401,
            detail=str(error)
        )