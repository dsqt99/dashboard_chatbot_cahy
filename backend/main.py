from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from markitdown import MarkItDown
import shutil
import os
import tempfile

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/convert")
async def convert_to_markdown(
    request: Request,
    file: UploadFile = File(None),
    x_filename: str | None = Header(None)
):
    tmp_path = None
    filename = "document"
    
    try:
        content_type = request.headers.get("content-type", "")
        
        # Determine source and filename
        if file and "multipart/form-data" in content_type:
            filename = file.filename or "document"
            ext = os.path.splitext(filename)[1]
            
            # Save uploaded file to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = tmp.name
        else:
            # Handle raw binary upload
            if x_filename:
                filename = x_filename
            
            # Try to guess extension from content-type if not in filename
            ext = os.path.splitext(filename)[1]
            if not ext:
                if "application/pdf" in content_type:
                    ext = ".pdf"
                elif "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
                    ext = ".docx"
                elif "image/jpeg" in content_type:
                    ext = ".jpg"
                elif "image/png" in content_type:
                    ext = ".png"
                elif "audio/mpeg" in content_type:
                    ext = ".mp3"
                elif "audio/wav" in content_type:
                    ext = ".wav"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                async for chunk in request.stream():
                    tmp.write(chunk)
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
