"""
email_service.py
----------------
Purpose:
    Email sending service using SendGrid.
    Falls back to console print if SENDGRID_API_KEY is not set.
"""

import os
from dotenv import load_dotenv

load_dotenv()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("EMAIL_FROM", "noreply@gooddriverprogram.com")
BASE_URL = os.getenv("FRONTEND_URL", "http://52.200.244.222:5173")


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
    reset_link = f"{BASE_URL}/reset-password?token={reset_token}"
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
        <p><a href="{BASE_URL}/account/settings">Review trusted devices</a></p>
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
        <p><a href="{BASE_URL}/account/settings">Review trusted devices</a></p>
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
        <p><a href="{BASE_URL}/driver/dashboard">Go to your dashboard</a></p>
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
        <p><a href="{BASE_URL}/driver/points">View your points history</a></p>
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
        <p><a href="{BASE_URL}/driver/catalog">Browse more items</a></p>
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
        <p><a href="{BASE_URL}/driver/orders">View your orders</a></p>
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
        <p><a href="{BASE_URL}/driver/orders">View your orders</a></p>
    """
    return _send(to_email, subject, html, plain)
