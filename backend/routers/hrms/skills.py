"""
Skills API router.
Handles fetching skill families and skills for dropdowns and autocomplete.
"""
import logging
import traceback
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional
from pydantic import BaseModel
from services.google_sheets import sheets_service
from config import settings

logger = logging.getLogger("chrms.skills")

router = APIRouter()


class SkillFamily(BaseModel):
    """Skill family with associated skills."""
    skill_family: str
    skills: List[str]


@router.get("/", response_model=List[SkillFamily])
async def get_skills():
    """Get all skill families with their skills."""
    try:
        records = sheets_service.get_all_records(settings.SKILLS_SHEET)
        result = []
        for record in records:
            family = str(record.get("Skill Family", "") or "").strip()
            skills_str = str(record.get("Skills", "") or "")
            if family:
                # Parse comma-separated skills
                skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                result.append(SkillFamily(skill_family=family, skills=skills))
        return result
    except Exception as e:
        logger.error(f"Error fetching skills: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/families", response_model=List[str])
async def get_skill_families():
    """Get list of unique skill family names for dropdown."""
    try:
        records = sheets_service.get_all_records(settings.SKILLS_SHEET)
        families = []
        for record in records:
            family = str(record.get("Skill Family", "") or "").strip()
            if family and family not in families:
                families.append(family)
        return families
    except Exception as e:
        logger.error(f"Error fetching skill families: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/family/{family_name}", response_model=List[str])
async def get_skills_by_family(family_name: str):
    """Get skills for a specific skill family (combining all rows with that family)."""
    try:
        records = sheets_service.get_all_records(settings.SKILLS_SHEET)
        all_skills = []
        for record in records:
            family = str(record.get("Skill Family", "") or "").strip()
            if family.lower() == family_name.lower():
                skills_str = str(record.get("Skills", "") or "")
                skills = [s.strip() for s in skills_str.split(",") if s.strip()]
                all_skills.extend(skills)
        # Remove duplicates while preserving order
        unique_skills = list(dict.fromkeys(all_skills))
        return unique_skills
    except Exception as e:
        logger.error(f"Error fetching skills for family {family_name}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=List[str])
async def search_skills(
    q: str = Query(..., min_length=1, description="Search query"),
    family: Optional[str] = Query(None, description="Optional skill family filter")
):
    """Search skills by name with optional family filter."""
    try:
        records = sheets_service.get_all_records(settings.SKILLS_SHEET)
        all_skills = []
        
        for record in records:
            record_family = str(record.get("Skill Family", "") or "").strip()
            skills_str = str(record.get("Skills", "") or "")
            skills = [s.strip() for s in skills_str.split(",") if s.strip()]
            
            # If family filter provided, only include skills from that family
            if family and record_family.lower() != family.lower():
                continue
            
            all_skills.extend(skills)
        
        # Remove duplicates
        unique_skills = list(dict.fromkeys(all_skills))
        
        # Filter by search query (case-insensitive)
        query_lower = q.lower()
        matching_skills = [s for s in unique_skills if query_lower in s.lower()]
        
        # Sort: exact matches first, then starts-with, then contains
        def sort_key(skill):
            skill_lower = skill.lower()
            if skill_lower == query_lower:
                return (0, skill)
            if skill_lower.startswith(query_lower):
                return (1, skill)
            return (2, skill)
        
        matching_skills.sort(key=sort_key)
        
        return matching_skills[:20]  # Limit to 20 results
    except Exception as e:
        logger.error(f"Error searching skills: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=List[str])
async def get_all_skills_list():
    """Get a flat list of all unique skills across all families."""
    try:
        records = sheets_service.get_all_records(settings.SKILLS_SHEET)
        all_skills = []
        
        for record in records:
            skills_str = str(record.get("Skills", "") or "")
            skills = [s.strip() for s in skills_str.split(",") if s.strip()]
            all_skills.extend(skills)
        
        # Remove duplicates while preserving order
        unique_skills = list(dict.fromkeys(all_skills))
        return unique_skills
    except Exception as e:
        logger.error(f"Error fetching all skills: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
