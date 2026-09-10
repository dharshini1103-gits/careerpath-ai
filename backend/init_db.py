from database.connection import engine, Base
from database import models

print("Creating CareerPath database tables...")

Base.metadata.create_all(bind=engine)

print("✅ Tables created successfully!")