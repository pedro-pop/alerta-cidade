from fastapi import Depends, Header, HTTPException

from app.supabase_client import get_authenticated_client


def get_current_user(
    authorization: str | None = Header(default=None)
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Token de autenticação não informado."
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Formato do token inválido."
        )

    token = authorization.replace("Bearer ", "", 1).strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Token de autenticação vazio."
        )

    try:
        client = get_authenticated_client(token)

        response = client.auth.get_user(token)

        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Token inválido."
            )

        return {
            "user": response.user,
            "client": client
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Token inválido ou expirado."
        )


def require_role(*allowed_roles):

    def role_checker(
        auth_data=Depends(get_current_user)
    ):
        current_user = auth_data["user"]
        client = auth_data["client"]

        try:
            profile = (
                client
                .table("profiles")
                .select("id, name, role")
                .eq("id", current_user.id)
                .single()
                .execute()
            )

            if not profile.data:
                raise HTTPException(
                    status_code=403,
                    detail="Perfil do usuário não encontrado."
                )

            if profile.data["role"] not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail="Você não possui permissão para esta ação."
                )

            return profile.data

        except HTTPException:
            raise

        except Exception:
            raise HTTPException(
                status_code=403,
                detail="Não foi possível verificar as permissões do usuário."
            )

    return role_checker