from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user


router = APIRouter(
    prefix="/notificacoes",
    tags=["Notificações"]
)


@router.get("/")
def list_notifications(
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        response = (
            client
            .table("notifications")
            .select("*")
            .eq("user_id", current_user.id)
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "notifications": response.data
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        response = (
            client
            .table("notifications")
            .update({"read": True})
            .eq("id", notification_id)
            .eq("user_id", current_user.id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Notificação não encontrada."
            )

        return {
            "message": "Notificação marcada como lida.",
            "notification": response.data[0]
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.patch("/read-all")
def mark_all_notifications_read(
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        response = (
            client
            .table("notifications")
            .update({"read": True})
            .eq("user_id", current_user.id)
            .eq("read", False)
            .execute()
        )

        return {
            "message": "Todas as notificações foram marcadas como lidas.",
            "updated": len(response.data)
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )