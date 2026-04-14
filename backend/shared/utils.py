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
# re - regular expressions let you search text for patterns
# Ex:
# Does the string contain a number?
# Does it contain uppercase letters? 
import re


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
# function return a tuple with:
# A boolean
# A string
def validate_password(password: str) -> tuple[bool, str]:

    # if less than 8 -> fail
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    # r'' means raw string (used for regex)
    # [A-Z] means any uppercase letter
    # re.search(pattern, string) returns a match if found
    # if no uppercase letter exists -> fail
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    # check for lowercase letter
    # same logic as for uppercase
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    # check for digit 
    # same as letters above
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    # check for special character
    # same as above
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
    
    # all checks passed - (pass) tuple returned 
    return True, "" 



"""
    Basic input sanitization to trim whitespace and prevent common input errors

    Args:
        input_str: Input string to sanitize

    Returns:
        str: Sanitized string (trimmed whitespace)
    """

# takes a string and returns a cleaned string
def sanitize_input(input_str: str) -> str:
    
    if not input_str:
        return ""
    
    # remove leading or trailing whitespace 
    # removes bugs like Username: "admin " instead of "admin"
    return input_str.strip()