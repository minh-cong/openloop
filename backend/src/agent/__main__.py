#!/usr/bin/env python3
"""
Main entry point for the OpenLoop Research Assistant agent module.
"""

import uvicorn
from agent.app import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=2024)
