from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.supabase_client import supabase
from app.dependencies import get_current_user


router = APIRouter(
    prefix="/auth",
    tags=["Autenticação"]
)


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

        access_token = response.session.access_token

        # Cliente autenticado com o JWT do usuário.
        from app.supabase_client import get_authenticated_client

        client = get_authenticated_client(access_token)

        profile_response = (
            client
            .table("profiles")
            .select("id, name, role, photo_url")
            .eq("id", response.user.id)
            .single()
            .execute()
        )

        profile = profile_response.data

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Perfil do usuário não encontrado."
            )

        return {
            "message": "Login realizado com sucesso.",
            "access_token": access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "name": profile["name"],
                "role": profile["role"],
                "photoUrl": profile.get("photo_url")
            }
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=401,
            detail=str(error)
        )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    user = current_user["user"]
    client = current_user["client"]

    try:
        profile_response = (
            client
            .table("profiles")
            .select("id, name, role, photo_url")
            .eq("id", user.id)
            .single()
            .execute()
        )

        profile = profile_response.data

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Perfil do usuário não encontrado."
            )

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": profile["name"],
                "role": profile["role"],
                "photoUrl": profile.get("photo_url")
            }
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Não foi possível carregar o perfil do usuário."
        )