# Backend Service for File Conversion

This service uses [MarkItDown](https://github.com/microsoft/markitdown) to convert various file formats (PDF, Excel, Word, etc.) into Markdown text.

## Setup

1.  Install Python 3.10+
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Run

```bash
python main.py
```
The server will start at `http://localhost:8000`.

## API Usage

### POST /convert

Converts an uploaded file to Markdown.

**Request:**
-   `Content-Type`: `multipart/form-data`
-   `file`: The binary file to convert.

**Response:**
```json
{
  "markdown": "Converted markdown content...",
  "filename": "original_filename.pdf"
}
```
