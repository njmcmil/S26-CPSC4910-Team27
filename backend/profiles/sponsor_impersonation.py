from fastapi import APIRouter, Depends, HTTPException, Request
from auth.auth import require_role, create_access_token
from shared.services import get_user_by_id
from shared.db import get_connection

router = APIRouter(prefix="/sponsor", tags=["Sponsor Impersonation"])


def log_impersonation(sponsor_id: int, driver_id: int, action: str, request: Request):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO impersonation_audit
        (sponsor_user_id, driver_user_id, action, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            sponsor_id,
            driver_id,
            action,
            request.client.host if request.client else None,
            request.headers.get("user-agent"),
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()


@router.post("/impersonate/{driver_user_id}")
def impersonate_driver(
    driver_user_id: int,
    request: Request,
    sponsor_user=Depends(require_role("sponsor")),
):
    """
    Sponsor impersonates a driver.
    """

    driver = get_user_by_id(driver_user_id)

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if driver.get("role") != "driver":
        raise HTTPException(status_code=400, detail="Can only impersonate drivers")

    token = create_access_token(
        data={
            "user_id": driver_user_id,
            "role": driver["role"],
        },
        impersonation={
            "sponsor_user_id": sponsor_user["user_id"],
        },
    )

    log_impersonation(
        sponsor_user["user_id"],
        driver_user_id,
        "START",
        request,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "impersonating": True,
    }


@router.post("/stop-impersonation")
def stop_impersonation(
    request: Request,
    current_user=Depends(require_role("sponsor")),
):
    log_impersonation(
        current_user["user_id"],
        current_user["user_id"],
        "STOP",
        request,
    )

    return {"message": "Impersonation ended"}