from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from markitdown import MarkItDown
import shutil
import os
import tempfile
import base64
import binascii

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConvertRequest(BaseModel):
    base64_content: str
    filename: str = "document"

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/convert")
async def convert_to_markdown(request: ConvertRequest):
    tmp_path = None
    
    try:
        # Decode base64 content
        try:
            # Handle data URI scheme if present (e.g., data:application/pdf;base64,...)
            if "," in request.base64_content:
                content_str = request.base64_content.split(",", 1)[1]
            else:
                content_str = request.base64_content
                
            file_content = base64.b64decode(content_str)
        except binascii.Error as e:
            raise HTTPException(status_code=400, detail="Invalid base64 content")

        # Determine extension
        filename = request.filename or "document"
        ext = os.path.splitext(filename)[1]
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        # Convert using MarkItDown
        md = MarkItDown()
        result = md.convert(tmp_path)
        
        return {
            "markdown": result.text_content,
            "filename": filename
        }
        
    except Exception as e:
        print(f"Error converting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception as e:
                print(f"Error removing temp file: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=2312)
