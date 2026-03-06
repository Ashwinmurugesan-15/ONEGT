import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from dotenv import load_dotenv

# Load existing .env if present
load_dotenv()

def get_refresh_token():
    """
    Helper script to obtain a Google OAuth2 Refresh Token.
    Requires 'GOOGLE_CLIENT_ID' and 'GOOGLE_CLIENT_SECRET' to be set in .env
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    print("\n--- Google OAuth2 Refresh Token Helper ---")
    
    if not client_id or not client_secret:
        print("Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not found in .env")
        print("Please add them to your .env file first.")
        return

    # Scope required for Gmail SMTP
    scopes = ["https://mail.google.com/"]

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    try:
        # Use port=0 to find an available port automatically
        flow = InstalledAppFlow.from_client_config(client_config, scopes=scopes)
        credentials = flow.run_local_server(port=0, prompt='consent', access_type='offline')

        print("\n--- SUCCESS ---")
        print(f"Refresh Token: {credentials.refresh_token}")
        print("\nUpdate your .env file with this token:")
        print(f"GOOGLE_REFRESH_TOKEN={credentials.refresh_token}")
        
    except Exception as e:
        print(f"\nError: {e}")
        print("\nTroubleshooting tips:")
        print("1. Ensure your Client ID is a 'Desktop app' type.")
        print("2. Add your email as a 'Test User' in the OAuth consent screen.")
        print("3. Ensure Gmail API is enabled.")

if __name__ == "__main__":
    get_refresh_token()
