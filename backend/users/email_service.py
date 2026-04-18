"""
email_service.py
----------------
Purpose:
    Email sending service using SendGrid.
    Falls back to console print if SENDGRID_API_KEY is not set.
"""

import os
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("EMAIL_FROM", "teamtwentyseven3@gmail.com")
BASE_URL = os.getenv("FRONTEND_URL", "http://52.200.244.222:5173").rstrip("/")


def _app_link(path: str) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{BASE_URL}{normalized_path}"


def _send(to_email: str, subject: str, html: str, plain: str) -> bool:
    """Internal helper — sends via SendGrid or prints to console."""
    if SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            message = Mail(
                from_email=FROM_EMAIL,
                to_emails=to_email,
                subject=subject,
                html_content=html,
                plain_text_content=plain,
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            return response.status_code == 202
        except Exception as e:
            print(f"[EMAIL ERROR] {e}")
            return False
    else:
        print(f"\n[MOCK EMAIL] To: {to_email} | Subject: {subject}\n{plain}\n")
        return True


def send_password_reset_email(to_email: str, reset_token: str, username: str) -> bool:
    reset_link = _app_link(f"/reset-password?token={quote(reset_token, safe='')}")
    subject = "Password Reset Request - Good Driver Incentive Program"
    plain = f"Hello {username},\n\nReset your password: {reset_link}\n\nExpires in 24 hours."
    html = f"""
        <h2>Password Reset Request</h2>
        <p>Hello {username},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{reset_link}">Reset My Password</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't request this, ignore this email.</p>
    """
    return _send(to_email, subject, html, plain)


def send_password_change_confirmation(to_email: str, username: str) -> bool:
    subject = "Password Changed - Good Driver Incentive Program"
    plain = f"Hello {username},\n\nYour password was successfully changed.\n\nIf you did not make this change, contact support immediately."
    html = f"""
        <h2>Password Changed</h2>
        <p>Hello {username},</p>
        <p>Your password was successfully changed.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p><a href="{_app_link('/account/settings')}">Review account settings</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_login_notification_email(
    to_email: str,
    username: str,
    login_time: str,
    ip_address: str,
    device_name: str,
    browser_name: str,
    os_name: str,
) -> bool:
    subject = "New Login Detected - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        "A login to your account was detected.\n\n"
        f"Time: {login_time}\n"
        f"IP Address: {ip_address}\n"
        f"Device: {device_name}\n"
        f"Browser: {browser_name}\n"
        f"Operating System: {os_name}\n\n"
        "If this was not you, change your password immediately and review your trusted devices."
    )
    html = f"""
        <h2>New Login Detected</h2>
        <p>Hello {username},</p>
        <p>A login to your account was detected.</p>
        <ul>
            <li><strong>Time:</strong> {login_time}</li>
            <li><strong>IP Address:</strong> {ip_address}</li>
            <li><strong>Device:</strong> {device_name}</li>
            <li><strong>Browser:</strong> {browser_name}</li>
            <li><strong>Operating System:</strong> {os_name}</li>
        </ul>
        <p>If this was not you, change your password immediately and review your trusted devices.</p>
        <p><a href="{_app_link('/account/settings')}">Review trusted devices</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_failed_login_alert_email(
    to_email: str,
    username: str,
    attempt_time: str,
    attempted_username: str,
    ip_address: str,
    device_name: str,
    browser_name: str,
    os_name: str,
) -> bool:
    subject = "Failed Login Attempt Alert - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        "A failed login attempt was made on your account.\n\n"
        f"Attempted Username: {attempted_username}\n"
        f"Time: {attempt_time}\n"
        f"IP Address: {ip_address}\n"
        f"Device: {device_name}\n"
        f"Browser: {browser_name}\n"
        f"Operating System: {os_name}\n\n"
        "If this was not you, reset your password and review your trusted devices immediately."
    )
    html = f"""
        <h2>Failed Login Attempt Alert</h2>
        <p>Hello {username},</p>
        <p>A failed login attempt was made on your account.</p>
        <ul>
            <li><strong>Attempted Username:</strong> {attempted_username}</li>
            <li><strong>Time:</strong> {attempt_time}</li>
            <li><strong>IP Address:</strong> {ip_address}</li>
            <li><strong>Device:</strong> {device_name}</li>
            <li><strong>Browser:</strong> {browser_name}</li>
            <li><strong>Operating System:</strong> {os_name}</li>
        </ul>
        <p>If this was not you, reset your password and review your trusted devices immediately.</p>
        <p><a href="{_app_link('/account/settings')}">Review trusted devices</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_driver_application_rejection_email(
    to_email: str,
    username: str,
    rejection_category: str,
    rejection_reason: str
) -> bool:
    subject = "Driver Application Update - Good Driver Incentive Program"
    plain = f"Hello {username},\n\nYour application was not approved.\n\nCategory: {rejection_category}\nDetails: {rejection_reason}"
    html = f"""
        <h2>Driver Application Update</h2>
        <p>Hello {username},</p>
        <p>After careful review, your driver application was not approved at this time.</p>
        <p><strong>Rejection Category:</strong> {rejection_category}</p>
        <p><strong>Details:</strong> {rejection_reason}</p>
        <p>You are welcome to address the feedback and apply again in the future.</p>
    """
    return _send(to_email, subject, html, plain)


def send_driver_application_approval_email(
    to_email: str,
    username: str,
    sponsor_name: str | None = None
) -> bool:
    sponsor_text = f" by {sponsor_name}" if sponsor_name else ""
    subject = "Your Driver Application Was Approved!"
    plain = f"Hello {username},\n\nCongratulations! Your application{sponsor_text} has been approved.\n\nYou can now earn and redeem points."
    html = f"""
        <h2>Application Approved! 🎉</h2>
        <p>Hello {username},</p>
        <p>Your driver application{sponsor_text} has been <strong>approved</strong>.</p>
        <p>You are now eligible to earn reward points and redeem them for incentives.</p>
        <p><a href="{_app_link('/driver/dashboard')}">Go to your dashboard</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_points_notification(
    to_email: str,
    username: str,
    points_changed: int,
    reason: str,
    new_total: int
) -> bool:
    action = "added to" if points_changed > 0 else "deducted from"
    sign = "+" if points_changed > 0 else ""
    subject = "Points Update - Good Driver Incentive Program"
    plain = f"Hello {username},\n\n{sign}{points_changed} points have been {action} your account.\n\nReason: {reason}\nNew Balance: {new_total} points"
    html = f"""
        <h2>Points Update</h2>
        <p>Hello {username},</p>
        <p><strong>{sign}{points_changed} points</strong> have been {action} your account.</p>
        <p><strong>Reason:</strong> {reason}</p>
        <p><strong>New Balance:</strong> {new_total} points</p>
        <p><a href="{_app_link('/driver/points')}">View your points history</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_dropped_by_sponsor_email(
    to_email: str,
    username: str,
    sponsor_name: str | None = None
) -> bool:
    sponsor_text = f" by {sponsor_name}" if sponsor_name else ""
    subject = "Sponsor Update - Good Driver Incentive Program"
    plain = f"Hello {username},\n\nYou have been removed from the program{sponsor_text}.\n\nIf you have questions, please contact support."
    html = f"""
        <h2>Sponsor Relationship Update</h2>
        <p>Hello {username},</p>
        <p>You have been removed from the program{sponsor_text}.</p>
        <p>If you have questions, please contact support.</p>
        <p><a href="{_app_link('/driver/applications')}">View available sponsors</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_removed_by_admin_email(
    to_email: str,
    username: str,
    role: str,
) -> bool:
    subject = "Account Access Removed - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        "An administrator removed your account access from the Good Driver Incentive Program.\n"
        "If this was unexpected, please contact support."
    )
    html = f"""
        <h2>Account Access Removed</h2>
        <p>Hello {username},</p>
        <p>An administrator removed your <strong>{role}</strong> account access from the Good Driver Incentive Program.</p>
        <p>If this was unexpected, please contact support.</p>
        <p><a href="{_app_link('/login')}">Return to login</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_order_placed_email(
    to_email: str,
    username: str,
    order_items: list,
    total_points: int,
    placed_at: str,
    ip_address: str,
    device_name: str,
    browser_name: str,
    os_name: str,
) -> bool:
    subject = "Order Confirmation - Good Driver Incentive Program"
    items_plain = "\n".join([f"- {item['title']} ({item['points_cost']} pts)" for item in order_items])
    items_html = "".join([f"<li>{item['title']} — {item['points_cost']} pts</li>" for item in order_items])
    plain = (
        f"Hello {username},\n\n"
        "Your order has been placed successfully.\n\n"
        f"Time: {placed_at}\n"
        f"IP Address: {ip_address}\n"
        f"Device: {device_name}\n"
        f"Browser: {browser_name}\n"
        f"Operating System: {os_name}\n\n"
        f"Items:\n{items_plain}\n\n"
        f"Total: {total_points} points"
    )
    html = f"""
        <h2>Order Confirmation 🎉</h2>
        <p>Hello {username},</p>
        <p>Your order has been placed successfully!</p>
        <ul>
            <li><strong>Time:</strong> {placed_at}</li>
            <li><strong>IP Address:</strong> {ip_address}</li>
            <li><strong>Device:</strong> {device_name}</li>
            <li><strong>Browser:</strong> {browser_name}</li>
            <li><strong>Operating System:</strong> {os_name}</li>
        </ul>
        <ul>{items_html}</ul>
        <p><strong>Total Points Used:</strong> {total_points}</p>
        <p><a href="{_app_link('/driver/orders')}">View your orders</a></p>
    """
    return _send(to_email, subject, html, plain)

def send_sponsor_order_placed_email(
    to_email: str,
    username: str,
    item_title: str,
    points_cost: int,
    placed_at: str,
    sponsor_name: str,
) -> bool:
    subject = "Order Placed by Your Sponsor - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        f"Your sponsor ({sponsor_name}) has placed an order using your points.\n\n"
        f"Item: {item_title}\n"
        f"Points Used: {points_cost}\n"
        f"Time: {placed_at}\n\n"
        "You can view your orders in the portal."
    )
    html = f"""
        <h2>Order Placed by Your Sponsor</h2>
        <p>Hello {username},</p>
        <p>Your sponsor (<strong>{sponsor_name}</strong>) has placed an order using your points.</p>
        <ul>
            <li><strong>Item:</strong> {item_title}</li>
            <li><strong>Points Used:</strong> {points_cost}</li>
            <li><strong>Time:</strong> {placed_at}</li>
        </ul>
        <p><a href="{_app_link('/driver/orders')}">View your orders</a></p>
    """
    return _send(to_email, subject, html, plain)

def send_sponsor_account_deactivated_email(
    to_email: str,
    username: str,
    company_name: str | None = None,
    reason: str | None = None,
) -> bool:
    name = company_name or username
    subject = "Account Deactivated - Good Driver Incentive Program"
    reason_text = f"\n\nReason: {reason}" if reason else ""
    plain = (
        f"Hello {username},\n\n"
        f"Your sponsor account ({name}) has been deactivated by an administrator.{reason_text}\n\n"
        "If you believe this is an error, please contact support."
    )
    html = f"""
        <h2>Account Deactivated</h2>
        <p>Hello {username},</p>
        <p>Your sponsor account (<strong>{name}</strong>) has been <strong>deactivated</strong> by an administrator.</p>
        {"<p><strong>Reason:</strong> " + reason + "</p>" if reason else ""}
        <p>If you believe this is an error, please contact support.</p>
        <p><a href="{_app_link('/account-blocked')}">Request an account review</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_sponsor_account_banned_email(
    to_email: str,
    username: str,
    company_name: str | None = None,
    reason: str | None = None,
) -> bool:
    name = company_name or username
    subject = "Account Banned - Good Driver Incentive Program"
    reason_text = f"\n\nReason: {reason}" if reason else ""
    plain = (
        f"Hello {username},\n\n"
        f"Your sponsor account ({name}) has been banned by an administrator.{reason_text}\n\n"
        "If you believe this is an error, please contact support."
    )
    html = f"""
        <h2>Account Banned</h2>
        <p>Hello {username},</p>
        <p>Your sponsor account (<strong>{name}</strong>) has been <strong>banned</strong> by an administrator.</p>
        {"<p><strong>Reason:</strong> " + reason + "</p>" if reason else ""}
        <p>If you believe this is an error, please contact support.</p>
        <p><a href="{_app_link('/account-blocked')}">Request an account review</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_driver_account_deactivated_email(
    to_email: str,
    username: str,
    reason: str | None = None,
    changed_by_label: str = "an administrator",
) -> bool:
    subject = "Account Deactivated - Good Driver Incentive Program"
    reason_text = f"\n\nReason: {reason}" if reason else ""
    plain = (
        f"Hello {username},\n\n"
        f"Your driver account has been deactivated by {changed_by_label}.{reason_text}\n\n"
        "If you believe this is an error, please contact support or request a review."
    )
    html = f"""
        <h2>Account Deactivated</h2>
        <p>Hello {username},</p>
        <p>Your driver account has been <strong>deactivated</strong> by {changed_by_label}.</p>
        {"<p><strong>Reason:</strong> " + reason + "</p>" if reason else ""}
        <p>If you believe this is an error, please contact support or request a review.</p>
        <p><a href="{_app_link('/account-blocked')}">Request an account review</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_driver_account_banned_email(
    to_email: str,
    username: str,
    reason: str | None = None,
    changed_by_label: str = "an administrator",
) -> bool:
    subject = "Account Banned - Good Driver Incentive Program"
    reason_text = f"\n\nReason: {reason}" if reason else ""
    plain = (
        f"Hello {username},\n\n"
        f"Your driver account has been banned by {changed_by_label}.{reason_text}\n\n"
        "If you believe this is an error, please contact support or request a review."
    )
    html = f"""
        <h2>Account Banned</h2>
        <p>Hello {username},</p>
        <p>Your driver account has been <strong>banned</strong> by {changed_by_label}.</p>
        {"<p><strong>Reason:</strong> " + reason + "</p>" if reason else ""}
        <p>If you believe this is an error, please contact support or request a review.</p>
        <p><a href="{_app_link('/account-blocked')}">Request an account review</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_order_success_email(
    to_email: str,
    username: str,
    item_title: str,
    points_cost: int,
    placed_at: str,
    purchase_ip_address: str,
    purchase_device_name: str,
    purchase_browser_name: str,
    purchase_os_name: str,
) -> bool:
    subject = "Order Successful - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        "Your order is now successful.\n\n"
        f"Item: {item_title}\n"
        f"Points Used: {points_cost}\n"
        f"Original Purchase Time: {placed_at}\n"
        f"IP Address: {purchase_ip_address}\n"
        f"Device: {purchase_device_name}\n"
        f"Browser: {purchase_browser_name}\n"
        f"Operating System: {purchase_os_name}\n"
    )
    html = f"""
        <h2>Order Successful</h2>
        <p>Hello {username},</p>
        <p>Your order is now marked successful.</p>
        <ul>
            <li><strong>Item:</strong> {item_title}</li>
            <li><strong>Points Used:</strong> {points_cost}</li>
            <li><strong>Original Purchase Time:</strong> {placed_at}</li>
            <li><strong>IP Address:</strong> {purchase_ip_address}</li>
            <li><strong>Device:</strong> {purchase_device_name}</li>
            <li><strong>Browser:</strong> {purchase_browser_name}</li>
            <li><strong>Operating System:</strong> {purchase_os_name}</li>
        </ul>
        <p><a href="{_app_link('/driver/orders')}">View your orders</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_account_appeal_submitted_email(
    to_email: str,
    username: str,
    user_role: str,
    account_status: str,
) -> bool:
    subject = "Account Review Request Received - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        f"We received your {user_role} account review request for your {account_status} account status.\n\n"
        "An administrator will review your message and follow up inside the platform."
    )
    html = f"""
        <h2>Account Review Request Received</h2>
        <p>Hello {username},</p>
        <p>We received your <strong>{user_role}</strong> account review request for your <strong>{account_status}</strong> account status.</p>
        <p>An administrator will review your message and follow up inside the platform.</p>
        <p><a href="{_app_link('/account-blocked')}">Return to account review page</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_admin_account_appeal_notification_email(
    to_email: str,
    admin_username: str,
    requester_username: str,
    requester_role: str,
    account_status: str,
) -> bool:
    subject = "New Account Review Request - Good Driver Incentive Program"
    plain = (
        f"Hello {admin_username},\n\n"
        f"{requester_username} submitted a new {requester_role} account review request.\n\n"
        f"Current account status: {account_status}\n"
        f"Review it in the admin communication logs."
    )
    html = f"""
        <h2>New Account Review Request</h2>
        <p>Hello {admin_username},</p>
        <p><strong>{requester_username}</strong> submitted a new <strong>{requester_role}</strong> account review request.</p>
        <p><strong>Current account status:</strong> {account_status}</p>
        <p><a href="{_app_link('/admin/communication-logs')}">Open communication logs</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_account_appeal_resolved_email(
    to_email: str,
    username: str,
    status: str,
    admin_response: str | None = None,
) -> bool:
    resolved = status == "resolved"
    admin_response_plain = f"\n\nAdmin response: {admin_response}" if admin_response else ""
    follow_up_text = (
        "You can now sign back in to your account."
        if resolved
        else "You can review the update in the platform."
    )
    subject = (
        "Account Review Approved - Good Driver Incentive Program"
        if resolved
        else "Account Review Update - Good Driver Incentive Program"
    )
    plain = (
        f"Hello {username},\n\n"
        f"Your account review request has been marked as {status}."
        f"{admin_response_plain}\n\n"
        f"{follow_up_text}"
    )
    html = f"""
        <h2>{'Account Review Approved' if resolved else 'Account Review Update'}</h2>
        <p>Hello {username},</p>
        <p>Your account review request has been marked as <strong>{status}</strong>.</p>
        {"<p><strong>Admin response:</strong> " + admin_response + "</p>" if admin_response else ""}
        <p><a href="{_app_link('/login' if resolved else '/account-blocked')}">{'Sign in to your account' if resolved else 'View account review status'}</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_admin_account_access_email(
    to_email: str,
    username: str,
    admin_username: str,
    account_role: str,
) -> bool:
    subject = "Administrator Account Access Notice - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        f"An administrator ({admin_username}) accessed your {account_role} account using the internal view-as tool.\n\n"
        "This action is logged for security review."
    )
    html = f"""
        <h2>Administrator Account Access Notice</h2>
        <p>Hello {username},</p>
        <p>An administrator (<strong>{admin_username}</strong>) accessed your <strong>{account_role}</strong> account using the internal view-as tool.</p>
        <p>This action is logged for security review.</p>
        <p><a href="{_app_link('/account/settings')}">Review your account settings</a></p>
    """
    return _send(to_email, subject, html, plain)


def send_sponsor_account_created_email(
    to_email: str,
    username: str,
    temporary_password: str,
) -> bool:
    subject = "Your Sponsor Account Is Ready - Good Driver Incentive Program"
    plain = (
        f"Hello {username},\n\n"
        "An administrator created your sponsor account.\n\n"
        f"Username: {username}\n"
        f"Temporary Password: {temporary_password}\n\n"
        "Please sign in and change your password as soon as possible."
    )
    html = f"""
        <h2>Your Sponsor Account Is Ready</h2>
        <p>Hello {username},</p>
        <p>An administrator created your sponsor account.</p>
        <p><strong>Username:</strong> {username}</p>
        <p><strong>Temporary Password:</strong> {temporary_password}</p>
        <p><a href="{_app_link('/login')}">Sign in to your account</a></p>
        <p>After signing in, please update your password right away from account settings.</p>
    """
    return _send(to_email, subject, html, plain)
