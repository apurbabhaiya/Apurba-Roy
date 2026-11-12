"""Private CPU face encoder. Only accepts image bytes, never remote URLs."""
import base64
import binascii
import io
import os
import secrets
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_BYTES = 2_000_000
Image.MAX_IMAGE_PIXELS = 20_000_000
lock = threading.Lock()
engine = None
quotas = OrderedDict()
quota_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app):
    global engine
    if len(os.environ.get('FACE_SERVICE_KEY', '')) < 32:
        raise RuntimeError('FACE_SERVICE_KEY must contain at least 32 characters')
    if os.environ.get('FACE_MODEL_LICENSE_ACCEPTED') != 'true':
        raise RuntimeError('Configure an appropriately licensed model and acknowledge its terms first')
    from insightface.app import FaceAnalysis
    engine = FaceAnalysis(name=os.environ.get('FACE_MODEL_NAME', 'buffalo_l'),
                          root=os.environ.get('FACE_MODEL_ROOT', '/models'),
                          allowed_modules=['detection', 'recognition'],
                          providers=['CPUExecutionProvider'])
    engine.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.6)
    yield
    engine = None


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware('http')
async def guard_request(request: Request, call_next):
    if request.url.path == '/encode':
        expected = 'Bearer ' + os.environ.get('FACE_SERVICE_KEY', '')
        if not secrets.compare_digest(request.headers.get('authorization', ''), expected):
            return JSONResponse({'detail': 'Unauthorized'}, status_code=401)
        try:
            length = int(request.headers.get('content-length', '-1'))
        except ValueError:
            length = -1
        if length < 0 or length > 2_800_000:
            return JSONResponse({'detail': 'Image request too large or missing length'}, status_code=413)
    return await call_next(request)


class EncodeRequest(BaseModel):
    image: str = Field(min_length=4, max_length=2_666_672)
    reference: bool = False


def decode_image(encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_BYTES:
            raise ValueError()
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ('JPEG', 'PNG', 'WEBP'):
                raise ValueError()
            if image.width * image.height > 20_000_000:
                raise ValueError()
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600, 1600))
            return np.asarray(image)[:, :, ::-1].copy()
    except (ValueError, binascii.Error, UnidentifiedImageError, OSError,
            Image.DecompressionBombError):
        raise HTTPException(400, 'Invalid or oversized JPEG, PNG or WebP image')


@app.get('/health')
def health():
    return {'ready': engine is not None}


@app.post('/encode')
def encode(body: EncodeRequest, authorization: str = Header(default=''),
           x_face_user: str = Header(default='')):
    expected = 'Bearer ' + os.environ.get('FACE_SERVICE_KEY', '')
    if not secrets.compare_digest(authorization, expected):
        raise HTTPException(401, 'Unauthorized')
    if not x_face_user or len(x_face_user) > 80:
        raise HTTPException(401, 'Missing caller identity')
    with quota_lock:
        now = time.monotonic()
        started, count = quotas.get(x_face_user, (now, 0))
        if now - started >= 3600:
            started, count = now, 0
        if count >= 5000:
            raise HTTPException(429, 'Hourly face processing limit reached')
        if len(quotas) >= 10000 and x_face_user not in quotas:
            raise HTTPException(429, 'Face service capacity reached')
        quotas[x_face_user] = (started, count + 1)
        for user, (start, _) in list(quotas.items()):
            if now - start >= 3600:
                del quotas[user]
    image = decode_image(body.image)
    # Fail fast instead of accumulating inference jobs and exhausting memory.
    if not lock.acquire(blocking=False):
        raise HTTPException(429, 'Face service busy; retry shortly')
    try:
        if engine is None:
            raise HTTPException(503, 'Face model unavailable')
        faces = engine.get(image)
    finally:
        lock.release()
    if body.reference and len(faces) != 1:
        raise HTTPException(422, 'Use a clear photo containing exactly one face')
    if len(faces) > 100:
        raise HTTPException(422, 'Too many faces in one image')
    vectors = []
    for face in faces:
        vector = np.asarray(face.normed_embedding, dtype=float)
        if vector.shape != (512,) or not np.isfinite(vector).all():
            raise HTTPException(503, 'Invalid face model output')
        vectors.append(vector.tolist())
    return {'embeddings': vectors}
