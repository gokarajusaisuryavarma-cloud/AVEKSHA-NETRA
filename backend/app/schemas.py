from pydantic import BaseModel


# ==================================================
# CAMERA CREATE
# ==================================================

class CameraCreate(BaseModel):

    name: str
    location: str
    rtsp_url: str


# ==================================================
# CAMERA RESPONSE
# ==================================================

class CameraResponse(BaseModel):

    id: int
    name: str
    location: str
    rtsp_url: str
    source_type: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================================================
# USER REGISTRATION
# ==================================================

class UserCreate(BaseModel):

    username: str
    password: str


# ==================================================
# USER RESPONSE
# ==================================================

class UserResponse(BaseModel):

    id: int
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================================================
# USER LOGIN
# ==================================================

class UserLogin(BaseModel):

    username: str
    password: str