import sqlite3
import json

db_path = '/Users/kbsivacse/Documents/Tools/OneGT/backend/sql_app.db'
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", [t['name'] for t in tables])
except Exception as e:
    print("Database error:", e)
