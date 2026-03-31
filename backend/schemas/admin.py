from pydantic import BaseModel


class RedemptionReportRow(BaseModel):
    sponsor_id: int
    sponsor_name: str
    item_id: str
    item_title: str
    current_stock: int
    total_redemptions: int
    pending_redemptions: int
    shipped_redemptions: int
    cancelled_redemptions: int
    total_points_redeemed: int
    last_redeemed_at: str | None


class RedemptionReportResponse(BaseModel):
    generated_at: str
    report_rows: list[RedemptionReportRow]
