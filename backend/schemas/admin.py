from typing import Literal

from pydantic import BaseModel, EmailStr


class AccountStatusChangeRequest(BaseModel):
    new_status: str
    reason: str | None = None


class SponsorAdminRow(BaseModel):
    user_id: int
    username: str
    email: str
    company_name: str | None
    account_status: str


class DriverAdminRow(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str | None
    last_name: str | None
    account_status: str


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

class SystemMetricsResponse(BaseModel):
    fetched_at: str
    # user counts
    total_users: int
    total_drivers: int
    total_sponsors: int
    total_admins: int
    # orders
    total_orders: int
    pending_orders: int
    shipped_orders: int
    cancelled_orders: int
    # points
    total_points_awarded: int
    total_points_redeemed: int
    # logins in last 24 hours
    logins_last_24h: int
    failed_logins_last_24h: int

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


class AccountAppealCreateRequest(BaseModel):
    message: str


class AccountAppealResolveRequest(BaseModel):
    admin_response: str | None = None
    status: str = "resolved"


class AccountAppealRow(BaseModel):
    appeal_id: int
    created_at: str
    user_id: int
    username: str | None
    user_role: str
    account_status: str
    target_admin_user_id: int | None
    target_admin_username: str | None
    message: str
    appeal_status: str
    admin_response: str | None
    reviewed_by_user_id: int | None
    reviewed_by_username: str | None
    reviewed_at: str | None


class AccountAppealListResponse(BaseModel):
    appeals: list[AccountAppealRow]


class AdminCreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Literal["driver", "sponsor", "admin"]
