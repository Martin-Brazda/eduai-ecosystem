from sqlalchemy import Column, String, JSON, DateTime
from database import Base
import datetime

class LibraryItem(Base):
    __tablename__ = "library_items"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False) 
    data = Column(JSON, nullable=False)  
    date = Column(DateTime, default=datetime.datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "date": self.date.strftime("%Y-%m-%d"),
            "data": self.data
        }
