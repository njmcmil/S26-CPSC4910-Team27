"""
email_service.py
----------------
Purpose:
    Email sending service

    MOCK VERSION - Prints emails to console instead of sending
    Replace with real email service for production

Responsibilities:
    - Send password reset emails
    - Format email content
    - (Future: Send other notification emails)

Usage:
    from email_service import send_password_reset_email

    success = send_password_reset_email(
        to_email="user@example.com",
        reset_token="abc123...",
        username="john_doe"
    )
"""

import os


def send_password_reset_email(to_email: str, reset_token: str, username: str) -> bool:
    """
    Send password reset email to user.

    MOCK VERSION: Prints email to console instead of actually sending.

    In production, replace this with:
    - SendGrid API
    - AWS SES
    - Other email service

    Args:
        to_email: Recipient email address
        reset_token: Password reset token
        username: User's username for personalization

    Returns:
        bool: True if "sent" successfully (always True in mock)

    Email Contents:
        - Subject: Password reset request
        - Body: Instructions + reset link with token
        - Link format: http://localhost:3000/reset-password?token={token}
    """
    # In production, this would be your actual domain
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"

    # Format the email
    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║           PASSWORD RESET EMAIL (MOCK)                        ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    From: noreply@gooddriverprogram.com
    Subject: Password Reset Request - Good Driver Incentive Program

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Hello {username},

    We received a request to reset your password for your Good Driver
    Incentive Program account.

    Click the link below to reset your password:

    {reset_link}

    This link will expire in 24 hours.

    If you didn't request this password reset, please ignore this email.
    Your password will remain unchanged.

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    For security reasons:
    - Never share this link with anyone
    - This link can only be used once
    - If you didn't request this, your account is still secure

    - Good Driver Incentive Program Team

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    TOKEN (for manual testing): {reset_token}

    ╚══════════════════════════════════════════════════════════════╝
    """

    # MOCK: Print to console instead of sending
    print(email_content)

    # In production, replace above with actual email sending:
    """
    # Example with SendGrid:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    message = Mail(
        from_email='noreply@gooddriverprogram.com',
        to_emails=to_email,
        subject='Password Reset Request',
        html_content=f'''
            <h2>Password Reset Request</h2>
            <p>Hello {username},</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset My Password</a></p>
            <p>This link expires in 24 hours.</p>
        '''
    )

    try:
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
    """

    # Mock always succeeds
    return True


def send_password_change_confirmation(to_email: str, username: str) -> bool:
    """
    Optional: Send confirmation email after password change.

    Good security practice to notify user when password changes.

    Args:
        to_email: User's email address
        username: User's username

    Returns:
        bool: True if sent successfully
    """
    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║           PASSWORD CHANGE CONFIRMATION (MOCK)                ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    From: noreply@gooddriverprogram.com
    Subject: Password Changed - Good Driver Incentive Program

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Hello {username},

    Your password was successfully changed.

    If you did not make this change, please contact support immediately.

    - Good Driver Incentive Program Team

    ╚══════════════════════════════════════════════════════════════╝
    """

    print(email_content)
    return True


def send_driver_application_rejection_email(
    to_email: str,
    username: str,
    rejection_category: str,
    rejection_reason: str
) -> bool:
    """
    Send driver application rejection email.

    MOCK VERSION: Prints email to console instead of actually sending.

    Args:
        to_email: Driver's email address
        username: Driver's username
        rejection_category: High-level rejection category
        rejection_reason: Detailed explanation for rejection

    Returns:
        bool: True if "sent" successfully (always True in mock)

    Email Contents:
        - Subject: Driver Application Update
        - Body: Rejection category + detailed reason
        - Purpose: Transparency and clear communication
    """

    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║        DRIVER APPLICATION STATUS UPDATE (MOCK)               ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    From: noreply@gooddriverprogram.com
    Subject: Driver Application Update - Good Driver Incentive Program

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Hello {username},

    Thank you for applying to participate in the Good Driver
    Incentive Program.

    After careful review, your driver application was not approved
    at this time.

    Rejection Category:
    {rejection_category}

    Additional Details:
    {rejection_reason}

    You are welcome to review this feedback, address any issues,
    and submit a new application in the future.

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    If you have questions, please contact support.

    - Good Driver Incentive Program Team

    ╚══════════════════════════════════════════════════════════════╝
    """

    # MOCK: Print to console instead of sending
    print(email_content)

    # Mock always succeeds
    return True


def send_driver_application_approval_email(
    to_email: str,
    username: str,
    sponsor_name: str | None = None
) -> bool:
    """
    Send driver application approval email.

    MOCK VERSION: Prints email to console instead of actually sending.

    Args:
        to_email: Driver's email address
        username: Driver's username
        sponsor_name: Name of the sponsor (optional)

    Returns:
        bool: True if "sent" successfully (always True in mock)
    """

    sponsor_text = f" by {sponsor_name}" if sponsor_name else ""

    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║        DRIVER APPLICATION APPROVED (MOCK)                    ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    From: noreply@gooddriverprogram.com
    Subject: Your Driver Application Was Approved!

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Hello {username},

    Congratulations! 🎉

    Your driver application{sponsor_text} has been APPROVED.

    You are now eligible to:
    - Deliver goods for your sponsor
    - Earn reward points
    - Redeem points for incentives

    You can view your updated application status in your dashboard.

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    If you have questions, please contact support.

    - Good Driver Incentive Program Team

    ╚══════════════════════════════════════════════════════════════╝
    """

    print(email_content)
    return True

def send_points_notification(
    to_email: str,
    username: str,
    points_changed: int,
    reason: str,
    new_total: int
) -> bool:
    """Send email notification when points are added or removed."""
    action = "added to" if points_changed > 0 else "deducted from"
    sign = "+" if points_changed > 0 else ""

    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║           POINTS UPDATE NOTIFICATION                         ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    Subject: Points Update - Good Driver Incentive Program

    Hello {username},

    {sign}{points_changed} points have been {action} your account.

    Reason: {reason}
    New Balance: {new_total} points

    Log in to view your full points history.

    - Good Driver Incentive Program Team
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(email_content)
    return True


def send_dropped_by_sponsor_email(
    to_email: str,
    username: str,
    sponsor_name: str | None = None
) -> bool:
    """Send mandatory email when a driver is dropped by a sponsor."""
    sponsor_text = f" by {sponsor_name}" if sponsor_name else ""

    email_content = f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║           SPONSOR RELATIONSHIP UPDATE                        ║
    ╚══════════════════════════════════════════════════════════════╝

    To: {to_email}
    Subject: Sponsor Update - Good Driver Incentive Program

    Hello {username},

    You have been removed from the program{sponsor_text}.

    If you have questions, please contact support.

    - Good Driver Incentive Program Team
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(email_content)
    return True
