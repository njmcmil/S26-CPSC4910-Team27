"""
utils.py
--------
Purpose:
    Store helper functions for Team27 application.

Responsibilities:
    - Password validation (length, complexity)
    - Input purification
    - Any reusable utility functions across modules

Usage:
    from utils import validate_password
    valid = validate_password("MyPass123!")
"""

import re

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password complexity

    Password Rules:
    - Minimum 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character (!@#$%^&*(),.?":{}|<>)

    Args:
        password: The password string to validate

    Returns:
        tuple: (is_valid: bool, error_message: str)
               If valid: (True, "")
               If invalid: (False, "specific error message")
    """

    # check minimum length 
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    # check for uppercase letter
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    # check for lowercase letter
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    # check for digit 
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    # check for special character
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
    
    # all checks passed
    return True, ""

def sanitize_input(input_str: str) -> str:
    """
    Basic input sanitization to trim whitespace and prevent common input errors

    Args:
        input_str: Input string to sanitize

    Returns:
        str: Sanitized string (trimmed whitespace)
    """
    if not input_str:
        return ""
    
    # remove leading or trailing whitespace 
    return input_str.strip()