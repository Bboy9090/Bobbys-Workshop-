"""
Enhancement Presets
Predefined enhancement configurations.
"""

PRESETS = {
    "forensic": {
        "spectral_gate_threshold": -40,
        "consonant_boost_db": 8.0,
        "high_pass_cutoff": 80,
        "normalize": True
    },
    "conversation": {
        "spectral_gate_threshold": -30,
        "consonant_boost_db": 6.0,
        "high_pass_cutoff": 100,
        "normalize": True
    },
    "light": {
        "spectral_gate_threshold": -20,
        "consonant_boost_db": 3.0,
        "high_pass_cutoff": 150,
        "normalize": True
    }
}
