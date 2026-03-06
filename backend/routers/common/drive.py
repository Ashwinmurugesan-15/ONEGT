from fastapi import APIRouter, HTTPException, Response
from services.google_drive import drive_service
import logging

logger = logging.getLogger("chrms.drive_proxy")

router = APIRouter()

@router.get("/drive-proxy/{file_id}")
async def drive_proxy(file_id: str):
    """
    Proxy endpoint to fetch binary content from Google Drive and stream it with the correct Content-Type.
    This resolves issues with <img> tags not rendering direct Drive links.
    """
    try:
        result = drive_service.get_file_binary_and_metadata(file_id)
        if not result:
            raise HTTPException(status_code=404, detail="File not found or access denied")
        
        content, mime_type = result
        
        return Response(content=content, media_type=mime_type)
    except Exception as e:
        logger.error(f"Error in drive_proxy for {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching file")
