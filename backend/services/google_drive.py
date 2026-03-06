import os
import logging
import traceback
from typing import Optional
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaInMemoryUpload, MediaIoBaseDownload
import io
from config import settings
from utils.logging_utils import trace_exceptions

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class GoogleDriveService:
    _instance = None
    _service = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._service is None:
            self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Google Drive service with service account or ADC."""
        scopes = ['https://www.googleapis.com/auth/drive']
        
        creds_path = settings.GOOGLE_CREDENTIALS_FILE
        
        try:
            if creds_path and os.path.exists(creds_path):
                credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)
            else:
                from google.auth import default
                credentials, project = default(scopes=scopes)
            
            self._service = build('drive', 'v3', credentials=credentials)
            logger.info("Google Drive service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive service: {e}")
            logger.error(traceback.format_exc())

    def _execute_with_retry(self, request, max_retries=4):
        """Execute a Google Drive API request with exponential backoff retries for SSL/Network errors."""
        import time
        for attempt in range(max_retries):
            try:
                # Rely on internal library retry first, then our custom loop
                return request.execute(num_retries=3)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                err_str = str(e).lower()
                if 'ssl' in err_str or 'eof' in err_str or 'connection' in err_str or 'reset' in err_str or 'timeout' in err_str or ('50' in err_str):
                    logger.warning(f"Drive API transient error (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {2 ** attempt}s...")
                    time.sleep(2 ** attempt)
                else:
                    raise

    
    @trace_exceptions
    def upload_file(self, content: str, filename: str, folder_id: Optional[str] = None) -> Optional[str]:
        """Upload a text file to Google Drive and return its ID."""
        try:
            file_metadata = {
                'name': filename,
                'mimeType': 'text/html'
            }
            if folder_id:
                file_metadata['parents'] = [folder_id]
            
            media = MediaInMemoryUpload(content.encode('utf-8'), mimetype='text/html', resumable=True)
            
            request = self._service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            )
            file = self._execute_with_retry(request)
            
            return file.get('id')
        except Exception as e:
            logger.error(f"Error uploading file to Drive: {e}")
            logger.error(traceback.format_exc())
            return None

    @trace_exceptions
    def update_file(self, file_id: str, content: str) -> bool:
        """Update existing file content in Google Drive."""
        try:
            media = MediaInMemoryUpload(content.encode('utf-8'), mimetype='text/html', resumable=True)
            
            request = self._service.files().update(
                fileId=file_id,
                media_body=media,
                supportsAllDrives=True
            )
            self._execute_with_retry(request)
            
            return True
        except Exception as e:
            logger.error(f"Error updating file in Drive: {e}")
            logger.error(traceback.format_exc())
            return False

    @trace_exceptions
    def get_file_content(self, file_id: str) -> Optional[str]:
        """Get file content from Google Drive."""
        try:
            logger.debug(f"Calling Google Drive API to get content for file_id: {file_id}")
            # Use get_media with supportsAllDrives=True
            request = self._service.files().get_media(
                fileId=file_id,
                supportsAllDrives=True
            )
            content = self._execute_with_retry(request)
            logger.debug(f"Successfully retrieved {len(content)} bytes from Drive for file_id: {file_id}")
            return content.decode('utf-8')
        except Exception as e:
            logger.error(f"Error getting file content from Drive for file_id {file_id}: {e}")
            logger.debug(traceback.format_exc())
            return None

    def get_file_binary_and_metadata(self, file_id: str) -> Optional[tuple[bytes, str]]:
        """Get binary file content and its mime type from Google Drive."""
        try:
            logger.debug(f"Getting binary content and metadata for file_id: {file_id}")
            
            # Get metadata for mimeType
            request = self._service.files().get(
                fileId=file_id, 
                fields='mimeType',
                supportsAllDrives=True
            )
            file_info = self._execute_with_retry(request)
            mime_type = file_info.get('mimeType', 'application/octet-stream')

            # Get binary content using chunked download to prevent SSL EOF errors on large media
            request = self._service.files().get_media(
                fileId=file_id,
                supportsAllDrives=True
            )
            
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request, chunksize=1024*1024*5) # 5MB chunks
            
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                if status:
                    logger.debug(f"Media download progress: {int(status.progress() * 100)}%.")
                    
            content = fh.getvalue()
            
            logger.info(f"Successfully retrieved binary file {file_id} ({len(content)} bytes, {mime_type})")
            return content, mime_type
        except Exception as e:
            logger.error(f"Error getting binary file from Drive for file_id {file_id}: {e}")
            logger.debug(traceback.format_exc())
            return None

    @trace_exceptions
    def create_folder(self, name: str, parent_folder_id: Optional[str] = None) -> Optional[str]:
        """Create a folder in Google Drive and return its ID."""
        try:
            file_metadata = {
                'name': name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_folder_id:
                file_metadata['parents'] = [parent_folder_id]
            
            request = self._service.files().create(
                body=file_metadata,
                fields='id',
                supportsAllDrives=True
            )
            folder = self._execute_with_retry(request)
            
            folder_id = folder.get('id')
            logger.info(f"Created Drive folder '{name}' with ID: {folder_id}")
            return folder_id
        except Exception as e:
            logger.error(f"Error creating folder '{name}' in Drive: {e}")
            logger.error(traceback.format_exc())
            return None

    @trace_exceptions
    def upload_file_binary(self, file_bytes: bytes, filename: str, mime_type: str, folder_id: Optional[str] = None) -> Optional[str]:
        """Upload a binary file (image/PDF) to Google Drive and return its ID."""
        try:
            file_metadata = {
                'name': filename,
            }
            if folder_id:
                file_metadata['parents'] = [folder_id]
            
            media = MediaInMemoryUpload(file_bytes, mimetype=mime_type, resumable=True)
            
            request = self._service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            )
            file = self._execute_with_retry(request)
            
            file_id = file.get('id')
            logger.info(f"Uploaded file '{filename}' to Drive with ID: {file_id}")
            return file_id
        except Exception as e:
            logger.error(f"Error uploading binary file to Drive: {e}")
            logger.error(traceback.format_exc())
            return None

    def delete_file(self, file_id: str) -> bool:
        """Delete a file from Google Drive."""
        try:
            request = self._service.files().delete(fileId=file_id, supportsAllDrives=True)
            self._execute_with_retry(request)
            return True
        except Exception as e:
            logger.error(f"Error deleting file from Drive: {e}")
            return False

    def make_public_reader(self, file_id: str) -> bool:
        """Make a file readable by anyone with the link."""
        try:
            user_permission = {
                'type': 'anyone',
                'role': 'reader',
            }
            request = self._service.permissions().create(
                fileId=file_id,
                body=user_permission,
                supportsAllDrives=True
            )
            self._execute_with_retry(request)
            logger.info(f"Made file {file_id} public reader")
            return True
        except Exception as e:
            logger.error(f"Error making file {file_id} public reader: {e}")
            return False

# Singleton instance
drive_service = GoogleDriveService()
