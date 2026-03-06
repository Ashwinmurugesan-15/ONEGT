import gspread
from google.oauth2.service_account import Credentials
from cachetools import TTLCache
from typing import List, Dict, Any, Optional
from config import settings
import os
import logging
import traceback
import queue
import threading
import time
from utils.logging_utils import trace_exceptions

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Cache for sheet data (TTL: 60 seconds)
cache = TTLCache(maxsize=100, ttl=60)

class GoogleSheetsService:
    _instance = None
    _pool = None
    _worksheets = {}  # Cache: (spreadsheet_id, sheet_name) -> Worksheet
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_pool()
        return cls._instance
    
    def _initialize_pool(self, pool_size: int = 5):
        """Initialize a pool of authorized gspread clients."""
        self._pool = queue.Queue(maxsize=pool_size)
        
        # Pre-warm the pool
        for _ in range(pool_size):
            client = self._create_client()
            if client:
                self._pool.put(client)
        
        logger.info(f"Initialized Google Sheets client pool with size {pool_size}")

    def _create_client(self):
        """Create a single authorized gspread client."""
        try:
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            creds_path = settings.GOOGLE_CREDENTIALS_FILE
            
            if creds_path and os.path.exists(creds_path):
                from google.oauth2.service_account import Credentials
                credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)
            else:
                from google.auth import default
                credentials, project = default(scopes=scopes)
            
            return gspread.authorize(credentials)
        except Exception as e:
            logger.error(f"Failed to create Google Sheets client: {e}")
            return None

    def _get_client(self):
        """Lease a client from the pool."""
        try:
            return self._pool.get(timeout=10)
        except queue.Empty:
            logger.warning("Client pool empty, creating a temporary client")
            return self._create_client()

    def _release_client(self, client):
        """Return a client to the pool."""
        if client:
            try:
                self._pool.put_nowait(client)
            except queue.Full:
                pass # Already full, discard

    def _get_worksheet(self, spreadsheet_id: str, sheet_name: str):
        """Get a worksheet object, using cache if available."""
        key = (spreadsheet_id, sheet_name)
        
        with self._lock:
            if key in self._worksheets:
                return self._worksheets[key]
        
        client = self._get_client()
        try:
            ss = client.open_by_key(spreadsheet_id)
            ws = ss.worksheet(sheet_name)
            with self._lock:
                self._worksheets[key] = ws
            return ws
        finally:
            self._release_client(client)

    def get_sheet(self, sheet_name: str):
        """Get a worksheet by name from HRMS spreadsheet."""
        if not settings.SPREADSHEET_ID:
            raise ValueError("Spreadsheet ID not configured")
        return self._get_worksheet(settings.SPREADSHEET_ID, sheet_name)
    
    def get_crms_sheet(self, sheet_name: str):
        """Get a worksheet by name from CRMS spreadsheet."""
        if not settings.CRMS_SPREADSHEET_ID:
            raise ValueError("CRMS Spreadsheet ID not configured")
        return self._get_worksheet(settings.CRMS_SPREADSHEET_ID, sheet_name)
    
    def get_all_records(self, sheet_name: str, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Get all records from a sheet as list of dictionaries. Robust to empty headers."""
        cache_key = f"records_{sheet_name}"
        
        if use_cache and cache_key in cache:
            return cache[cache_key]
        
        sheet = self.get_sheet(sheet_name)
        try:
            rows = sheet.get_all_values()
        except Exception:
            return []
            
        if not rows:
            return []
            
        # First row is headers - strip whitespace and newlines
        headers = [str(h).strip() for h in rows[0]]
        
        # Map indices to non-empty headers
        header_map = {i: h for i, h in enumerate(headers) if h}
        
        records = []
        for row in rows[1:]:
            record = {}
            for i, header in header_map.items():
                val = row[i] if i < len(row) else ""
                record[header] = val
            records.append(record)
        
        if use_cache:
            cache[cache_key] = records
        
        return records
    
    def get_crms_all_records(self, sheet_name: str, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Get all records from a CRMS sheet as list of dictionaries."""
        cache_key = f"crms_records_{sheet_name}"
        
        if use_cache and cache_key in cache:
            return cache[cache_key]
        
        sheet = self.get_crms_sheet(sheet_name)
        try:
            rows = sheet.get_all_values()
        except Exception as e:
            logger.error(f"Error fetching CRMS records from {sheet_name}: {e}")
            logger.error(traceback.format_exc())
            return []
            
        if not rows:
            return []
            
        headers = [str(h).strip() for h in rows[0]]
        header_map = {i: h for i, h in enumerate(headers) if h}
        
        records = []
        for row in rows[1:]:
            record = {}
            for i, header in header_map.items():
                val = row[i] if i < len(row) else ""
                record[header] = val
            records.append(record)
        
        if use_cache:
            cache[cache_key] = records
        
        return records
    
    def get_all_values(self, sheet_name: str) -> List[List[str]]:
        """Get all values from a sheet as 2D list."""
        sheet = self.get_sheet(sheet_name)
        return sheet.get_all_values()
    
    def get_row_by_id(self, sheet_name: str, id_column: str, id_value: str) -> Optional[Dict[str, Any]]:
        """Get a single row by ID."""
        records = self.get_all_records(sheet_name)
        search_val = str(id_value).strip()
        for record in records:
            if str(record.get(id_column, "")).strip() == search_val:
                return record
        return None
    
    def find_row_index(self, sheet_name: str, id_column: str, id_value: str) -> Optional[int]:
        """Find the row index (1-based) for a given ID."""
        # Use get_all_records (cached and robust) to find the record
        # BUT we need the exact index, and cache might be stale or filtered?
        # Actually, get_all_records returns cleaner data. 
        # If we use get_all_values, it matches the robust logic.
        sheet = self.get_sheet(sheet_name)
        rows = sheet.get_all_values()
        
        if not rows:
             return None
             
        # Identify the column index for the ID
        headers = [str(h).strip() for h in rows[0]]
        try:
            col_idx = headers.index(id_column)
        except ValueError:
            return None # Column not found
            
        search_val = str(id_value).strip()
        
        # Iterate rows (skip header)
        for idx, row in enumerate(rows[1:]):
            val = str(row[col_idx]).strip() if col_idx < len(row) else ""
            if val == search_val:
                return idx + 2  # +2 because row 1 is header, and index is 0-based
        return None
    
    def append_row(self, sheet_name: str, values: List[Any]) -> Dict[str, Any]:
        """Append a new row to the sheet."""
        sheet = self.get_sheet(sheet_name)
        sheet.append_row(values, value_input_option='USER_ENTERED')
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Row added successfully"}
    
    def append_rows(self, sheet_name: str, rows: List[List[Any]]) -> Dict[str, Any]:
        """Append multiple rows to the sheet in one API call."""
        if not rows:
            return {"success": True, "message": "No rows to add"}
            
        sheet = self.get_sheet(sheet_name)
        sheet.append_rows(rows, value_input_option='USER_ENTERED')
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": f"Successfully added {len(rows)} rows"}
    
    def update_row(self, sheet_name: str, row_index: int, values: List[Any]) -> Dict[str, Any]:
        """Update a row at the given index (1-based)."""
        sheet = self.get_sheet(sheet_name)
        
        num_cols = len(values)
        if num_cols <= 26:
            end_col = chr(ord('A') + num_cols - 1)
        else:
            first_char = chr(ord('A') + (num_cols - 1) // 26 - 1)
            second_char = chr(ord('A') + (num_cols - 1) % 26)
            end_col = first_char + second_char
        
        cell_range = f"A{row_index}:{end_col}{row_index}"
        sheet.update(cell_range, [values], value_input_option='USER_ENTERED')
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Row updated successfully"}
    
    def delete_row(self, sheet_name: str, row_index: int) -> Dict[str, Any]:
        """Delete a row at the given index (1-based)."""
        sheet = self.get_sheet(sheet_name)
        sheet.delete_rows(row_index)
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Row deleted successfully"}
    
    def clear_sheet(self, sheet_name: str) -> Dict[str, Any]:
        """Clear all content from a sheet (except header logic is handled by caller usually)."""
        sheet = self.get_sheet(sheet_name)
        sheet.clear()
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Sheet cleared successfully"}
    
    def update_values(self, sheet_name: str, values: List[List[Any]]) -> Dict[str, Any]:
        """Update multiple rows starting from A1."""
        sheet = self.get_sheet(sheet_name)
        sheet.update('A1', values, value_input_option='USER_ENTERED')
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Values updated successfully"}
    
    def clear_cache(self, sheet_name: Optional[str] = None):
        """Clear cache for a specific sheet or all sheets."""
        if sheet_name:
            cache_key = f"records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
        else:
            cache.clear()
    
    def create_sheet_if_not_exists(self, sheet_name: str, headers: List[str]) -> bool:
        """Create a new sheet with headers if it doesn't exist."""
        try:
            self.get_sheet(sheet_name)
            return False  # Sheet already exists
        except gspread.exceptions.WorksheetNotFound:
            client = self._get_client()
            try:
                ss = client.open_by_key(settings.SPREADSHEET_ID)
                worksheet = ss.add_worksheet(title=sheet_name, rows=1000, cols=len(headers))
                worksheet.append_row(headers)
                return True
            finally:
                self._release_client(client)
        return False
    
    def get_headers(self, sheet_name: str) -> List[str]:
        """Get the header row (first row) of a sheet."""
        sheet = self.get_sheet(sheet_name)
        values = sheet.row_values(1)
        return values if values else []
    
    def update_cell(self, sheet_name: str, row: int, col: int, value: Any) -> Dict[str, Any]:
        """Update a single cell at the given row and column (1-based)."""
        sheet = self.get_sheet(sheet_name)
        sheet.update_cell(row, col, value)
        
        # Invalidate cache
        cache_key = f"records_{sheet_name}"
        if cache_key in cache:
            del cache[cache_key]
        
        return {"success": True, "message": "Cell updated successfully"}
    
    @trace_exceptions
    def crms_append_row(self, sheet_name: str, values: List[Any]) -> Dict[str, Any]:
        """Append a new row to a CRMS sheet."""
        try:
            logger.debug(f"crms_append_row: sheet={sheet_name}, values={values}")
            sheet = self.get_crms_sheet(sheet_name)
            sheet.append_row(values, value_input_option='USER_ENTERED')
            
            # Invalidate cache
            cache_key = f"crms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            
            return {"success": True, "message": "Row added successfully"}
        except Exception as e:
            logger.error(f"Error in crms_append_row: {str(e)}")
            logger.error(f"Stack trace:\n{traceback.format_exc()}")
            raise
    
    @trace_exceptions
    def crms_find_row_index(self, sheet_name: str, id_column: str, id_value: str) -> Optional[int]:
        """Find the row index (1-based) for a given ID in CRMS sheet."""
        try:
            logger.debug(f"crms_find_row_index: sheet={sheet_name}, column={id_column}, value={id_value}")
            sheet = self.get_crms_sheet(sheet_name)
            rows = sheet.get_all_values()
            
            if not rows:
                return None
                
            headers = [str(h).strip() for h in rows[0]]
            try:
                col_idx = headers.index(id_column)
            except ValueError:
                return None
                
            search_val = str(id_value).strip()
            
            for idx, row in enumerate(rows[1:]):
                val = str(row[col_idx]).strip() if col_idx < len(row) else ""
                if val == search_val:
                    return idx + 2
            return None
        except Exception as e:
            logger.error(f"Error in crms_find_row_index: {str(e)}")
            logger.error(f"Stack trace:\n{traceback.format_exc()}")
            raise
    
    @trace_exceptions
    def crms_update_row(self, sheet_name: str, row_index: int, values: List[Any]) -> Dict[str, Any]:
        """Update a row at the given index (1-based) in CRMS sheet."""
        try:
            logger.debug(f"crms_update_row: sheet={sheet_name}, row={row_index}, values={values}")
            sheet = self.get_crms_sheet(sheet_name)
            
            num_cols = len(values)
            if num_cols <= 26:
                end_col = chr(ord('A') + num_cols - 1)
            else:
                first_char = chr(ord('A') + (num_cols - 1) // 26 - 1)
                second_char = chr(ord('A') + (num_cols - 1) % 26)
                end_col = first_char + second_char
            
            cell_range = f"A{row_index}:{end_col}{row_index}"
            sheet.update(cell_range, [values], value_input_option='USER_ENTERED')
            
            # Invalidate cache
            cache_key = f"crms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            
            return {"success": True, "message": "Row updated successfully"}
        except Exception as e:
            logger.error(f"Error in crms_update_row: {str(e)}")
            logger.error(f"Stack trace:\n{traceback.format_exc()}")
            raise
    
    @trace_exceptions
    def crms_delete_row(self, sheet_name: str, row_index: int) -> Dict[str, Any]:
        """Delete a row at the given index (1-based) in CRMS sheet."""
        try:
            logger.debug(f"crms_delete_row: sheet={sheet_name}, row={row_index}")
            sheet = self.get_crms_sheet(sheet_name)
            sheet.delete_rows(row_index)
            
            # Invalidate cache
            cache_key = f"crms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            
            return {"success": True, "message": "Row deleted successfully"}
        except Exception as e:
            logger.error(f"Error in crms_delete_row: {str(e)}")
            logger.error(f"Stack trace:\n{traceback.format_exc()}")
            raise
    
    def crms_get_row_by_id(self, sheet_name: str, id_column: str, id_value: str) -> Optional[Dict[str, Any]]:
        """Get a single row by ID from CRMS sheet."""
        records = self.get_crms_all_records(sheet_name)
        search_val = str(id_value).strip()
        for record in records:
            if str(record.get(id_column, "")).strip() == search_val:
                return record
        return None

    # ── PMS (Performance Management) helpers ──────────────────
    
    def get_pms_sheet(self, sheet_name: str):
        """Get a worksheet by name from PMS spreadsheet."""
        return self._get_worksheet(settings.PMS_SPREADSHEET_ID, sheet_name)

    @trace_exceptions
    def pms_get_all_records(self, sheet_name: str, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Get all records from a PMS sheet as list of dictionaries."""
        cache_key = f"pms_records_{sheet_name}"
        if use_cache and cache_key in cache:
            return cache[cache_key]
        
        try:
            sheet = self.get_pms_sheet(sheet_name)
            rows = sheet.get_all_values()
            if not rows or len(rows) < 2:
                return []
            raw_headers = rows[0]
            headers = [str(h).strip() for h in raw_headers if str(h).strip()]
            num_headers = len(headers)
            records = []
            for row in rows[1:]:
                if not any(str(cell).strip() for cell in row[:num_headers]):
                    continue
                record = {}
                for i, header in enumerate(headers):
                    record[header] = row[i] if i < len(row) else ""
                records.append(record)
            if use_cache:
                cache[cache_key] = records
            return records
        except Exception as e:
            logger.error(f"Error in pms_get_all_records({sheet_name}): {e}")
            return []

    @trace_exceptions
    def pms_append_row(self, sheet_name: str, values: List[Any]) -> Dict[str, Any]:
        """Append a new row to a PMS sheet."""
        try:
            sheet = self.get_pms_sheet(sheet_name)
            sheet.append_row(values, value_input_option='USER_ENTERED')
            cache_key = f"pms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            return {"success": True, "message": "Row added successfully"}
        except Exception as e:
            logger.error(f"Error in pms_append_row: {e}")
            raise

    @trace_exceptions
    def pms_append_rows(self, sheet_name: str, rows: List[List[Any]]) -> Dict[str, Any]:
        """Append multiple rows to a PMS sheet in one API call."""
        try:
            sheet = self.get_pms_sheet(sheet_name)
            sheet.append_rows(rows, value_input_option='USER_ENTERED')
            cache_key = f"pms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            return {"success": True, "message": f"{len(rows)} rows added successfully"}
        except Exception as e:
            logger.error(f"Error in pms_append_rows: {e}")
            raise

    @trace_exceptions
    def pms_find_row_index(self, sheet_name: str, id_column: str, id_value: str) -> Optional[int]:
        """Find the row index (1-based) for a given ID in PMS sheet."""
        try:
            sheet = self.get_pms_sheet(sheet_name)
            rows = sheet.get_all_values()
            if not rows:
                return None
            headers = [str(h).strip() for h in rows[0]]
            try:
                col_idx = headers.index(id_column)
            except ValueError:
                return None
            search_val = str(id_value).strip()
            for idx, row in enumerate(rows[1:]):
                val = str(row[col_idx]).strip() if col_idx < len(row) else ""
                if val == search_val:
                    return idx + 2
            return None
        except Exception as e:
            logger.error(f"Error in pms_find_row_index: {e}")
            raise

    @trace_exceptions
    def pms_update_row(self, sheet_name: str, row_index: int, values: List[Any]) -> Dict[str, Any]:
        """Update a row at the given index (1-based) in PMS sheet."""
        try:
            sheet = self.get_pms_sheet(sheet_name)
            num_cols = len(values)
            if num_cols <= 26:
                end_col = chr(ord('A') + num_cols - 1)
            else:
                first_char = chr(ord('A') + (num_cols - 1) // 26 - 1)
                second_char = chr(ord('A') + (num_cols - 1) % 26)
                end_col = first_char + second_char
            cell_range = f"A{row_index}:{end_col}{row_index}"
            sheet.update(cell_range, [values], value_input_option='USER_ENTERED')
            cache_key = f"pms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            return {"success": True, "message": "Row updated successfully"}
        except Exception as e:
            logger.error(f"Error in pms_update_row: {e}")
            raise

    @trace_exceptions
    def pms_delete_row(self, sheet_name: str, row_index: int) -> Dict[str, Any]:
        """Delete a row at the given index (1-based) in PMS sheet."""
        try:
            sheet = self.get_pms_sheet(sheet_name)
            sheet.delete_rows(row_index)
            cache_key = f"pms_records_{sheet_name}"
            if cache_key in cache:
                del cache[cache_key]
            return {"success": True, "message": "Row deleted successfully"}
        except Exception as e:
            logger.error(f"Error in pms_delete_row: {e}")
            raise

    def pms_get_row_by_id(self, sheet_name: str, id_column: str, id_value: str) -> Optional[Dict[str, Any]]:
        """Get a single row by ID from PMS sheet."""
        records = self.pms_get_all_records(sheet_name)
        search_val = str(id_value).strip()
        for record in records:
            if str(record.get(id_column, "")).strip() == search_val:
                return record
        return None

    def pms_create_sheet_if_not_exists(self, sheet_name: str, headers: List[str]) -> bool:
        """Create a new sheet with headers in PMS workbook if it doesn't exist."""
        try:
            self.get_pms_sheet(sheet_name)
            return False  # Sheet already exists
        except Exception:
            client = self._get_client()
            try:
                ss = client.open_by_key(settings.PMS_SPREADSHEET_ID)
                worksheet = ss.add_worksheet(title=sheet_name, rows=1000, cols=len(headers))
                worksheet.append_row(headers)
                return True
            finally:
                self._release_client(client)
        return False


# Singleton instance
sheets_service = GoogleSheetsService()
