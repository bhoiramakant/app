import os
from pathlib import Path
from typing import Annotated, Any, Optional

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

load_dotenv(Path(__file__).parent / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict[str, Any] | None):
        if not doc:
            return None
        return cls.model_validate(doc)

    def to_mongo(self) -> dict[str, Any]:
        data = self.model_dump(by_alias=True, exclude={"id"})
        if self.id:
            data["_id"] = ObjectId(self.id)
        return data


class User(BaseDocument):
    email: str
    password_hash: str
    created_at: str


class WatchItem(BaseDocument):
    user_id: str
    symbol: str
    market: str
    name: str
    currency: str
    av_symbol: Optional[str] = None
    cg_id: Optional[str] = None
    tv_symbol: str
    added_at: str


class Alert(BaseDocument):
    user_id: str
    symbol: str
    market: str
    strategy: str
    timeframe: str
    kind: str  # ready | upcoming | bearish | info
    title: str
    body: str
    read: bool = False
    created_at: str
