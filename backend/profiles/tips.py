from fastapi import APIRouter, Depends, HTTPException
from typing import List
from auth.auth import get_current_user
from schemas.points import Tip, TipCreate, TipViewCreate
from services.tips_service import (
    get_active_tips_for_sponsor,
    create_tip,
    mark_tip_viewed
)
from services.driver_service import get_driver_sponsor_id


router = APIRouter(
    prefix="/tips",
    tags=["Tips"]
)

# =====================================================
# DRIVER — GET TIPS
# =====================================================
@router.get("/", response_model=List[Tip])
def fetch_tips(current_user: dict = Depends(get_current_user)):

    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can fetch tips")

    sponsor_id = get_driver_sponsor_id(current_user["user_id"])

    return get_active_tips_for_sponsor(sponsor_id)


# =====================================================
# SPONSOR — CREATE TIP
# =====================================================
@router.post("/", response_model=Tip)
def add_tip(
    tip: TipCreate,
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403)

    return create_tip(
        sponsor_user_id=current_user["user_id"],
        tip_text=tip.tip_text,
        category=tip.category,
        active=tip.active
    )


# =====================================================
# DRIVER — MARK TIP VIEWED
# =====================================================
@router.post("/view")
def view_tip(
    data: TipViewCreate,
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] != "driver":
        raise HTTPException(status_code=403)

    mark_tip_viewed(
        driver_id=current_user["user_id"],
        tip_id=data.tip_id
    )

    return {"success": True}