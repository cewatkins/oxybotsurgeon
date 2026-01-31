# Backend API for OxyOsbourne Surgical Console
#
# Usage:
# 1. Set your YouTube API key in .env
# 2. Run: uvicorn backend:app --reload
# 3. The React UI can now call /videos, /video/{id}, /random_video endpoints for real data.
#
# Endpoints:
#   GET /videos?query=...         # Search channel videos
#   GET /video/{video_id}         # Get video metadata (and transcript, TODO)
#   GET /random_video             # Get a random video from the channel

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import random
import requests
import os
from dotenv import load_dotenv

load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID = os.getenv("YOUTUBE_CHANNEL_ID") or os.getenv("CHANNEL_ID")

app = FastAPI()

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class VideoMetaData(BaseModel):
    id: str
    title: str
    url: str
    publishedAt: Optional[str] = None
    description: Optional[str] = None
    transcription: Optional[str] = None

# --- YouTube Data Fetching ---
# Helper to fetch videos

def fetch_channel_videos(query: Optional[str] = None):
    # This is a simplified version. In production, handle pagination, errors, etc.
    url = f"https://www.googleapis.com/youtube/v3/search?key={YOUTUBE_API_KEY}&channelId={CHANNEL_ID}&part=snippet&type=video&maxResults=50"
    if query:
        url += f"&q={query}"
    resp = requests.get(url)
    data = resp.json()
    videos = []
    for item in data.get("items", []):
        snippet = item["snippet"]
        videos.append(VideoMetaData(
            id=item["id"]["videoId"],
            title=snippet["title"],
            url=f"https://www.youtube.com/watch?v={item['id']['videoId']}",
            publishedAt=snippet.get("publishedAt"),
            description=snippet.get("description"),
        ))
    return videos

@app.get("/videos", response_model=List[VideoMetaData])
def get_videos(query: Optional[str] = Query(None)):
    return fetch_channel_videos(query)

@app.get("/video/{video_id}", response_model=VideoMetaData)
def get_video(video_id: str):
    # Fetch video details and transcript (if available)
    # For demo, just return metadata
    videos = fetch_channel_videos()
    for v in videos:
        if v.id == video_id:
            # TODO: Add transcript fetching here
            return v
    return {}

@app.get("/random_video", response_model=VideoMetaData)
def get_random_video():
    videos = fetch_channel_videos()
    return random.choice(videos) if videos else {}
