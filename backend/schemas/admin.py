from pydantic import BaseModel

class DriverSponsorRow(BaseModel):
    id: int
    name: str
    status: str | None
    total_points:int
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


class LoginAuditRow(BaseModel):
    user_id: int | None
    username: str
    role: str | None
    success: bool
    ip_address: str | None
    user_agent: str | None
    login_time: str


class LoginAuditResponse(BaseModel):
    login_audit: list[LoginAuditRow]

class CommunicationLogRow(BaseModel):
    log_id: int
    created_at: str
    driver_user_id: int
    driver_name: str | None
    sponsor_user_id: int
    sponsor_name: str | None
    sent_by_role: str
    message: str

class CommunicationLogResponse(BaseModel):
    communication_logs: list[CommunicationLogRow]

class OperationsSummaryResponse(BaseModel):
    period: str
    date_from: str
    date_to: str
    generated_at: str
    # Orders
    total_orders: int
    pending_orders: int
    shipped_orders: int
    cancelled_orders: int
    points_redeemed_via_orders: int
    active_drivers: int
    active_sponsors: int
    # Registrations
    new_drivers: int
    new_sponsors: int
    # Points awarded
    points_awarded: int
    # Logins
    total_logins: int
    failed_logins: int
