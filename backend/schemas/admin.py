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


class AuditLogRow(BaseModel):
    date: str
    category: str
    sponsor_id: int | None
    sponsor_name: str | None
    driver_id: int | None
    points_changed: int | None
    reason: str | None
    changed_by_user_id: int | None


class AuditLogResponse(BaseModel):
    audit_logs: list[AuditLogRow]
