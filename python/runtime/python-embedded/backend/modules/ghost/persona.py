"""
Burner Persona Generator
Creates temporary identities for operations.
"""

import random
import string
from datetime import datetime
from typing import Optional, Dict


def create_burner_persona(name: Optional[str] = None, email_domain: Optional[str] = None) -> Dict:
    """Create a burner persona."""
    if not name:
        name = generate_random_name()
    
    if not email_domain:
        email_domain = "tempmail.com"
    
    username = generate_username(name)
    email = f"{username}@{email_domain}"
    
    persona = {
        "name": name,
        "username": username,
        "email": email,
        "phone": generate_phone_number(),
        "created_at": datetime.now().isoformat()
    }
    
    return persona


def generate_random_name() -> str:
    """Generate a random name."""
    first_names = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Avery"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
    
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def generate_username(name: str) -> str:
    """Generate username from name."""
    parts = name.lower().split()
    base = "".join(parts)
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{base}{suffix}"


def generate_phone_number() -> str:
    """Generate a random phone number."""
    area = random.randint(200, 999)
    exchange = random.randint(200, 999)
    number = random.randint(1000, 9999)
    return f"+1{area}{exchange}{number}"
