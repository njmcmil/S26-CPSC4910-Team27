from pydantic import BaseModel

class NotificationPreferences(BaseModel):
    points_email_enabled: bool = True
    orders_email_enabled: bool = True
