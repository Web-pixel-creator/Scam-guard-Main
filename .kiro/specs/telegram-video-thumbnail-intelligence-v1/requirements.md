# Requirements: Telegram Video Thumbnail Intelligence v1

## Overview

When a user forwards or sends a Telegram video, the bot should use any safe evidence Telegram already exposes before falling back to "I cannot analyze video yet". Full video analysis is out of scope for this slice. The bot must not download video files.

## Requirements

### R1. Video thumbnail routing

If a Telegram `video` message has no text/caption/inline-button evidence but includes a `thumbnail.file_id`, the router must route that thumbnail to the existing image check path.

Acceptance criteria:

- The route action is `image`.
- The routed `fileId` is the thumbnail file id, not the video file id.
- `media_group_id`, when present, is preserved.

### R2. Evidence priority

Textual evidence remains more important than a thumbnail.

Acceptance criteria:

- Video caption text routes to `check`.
- Caption `text_link` URLs route to `check`.
- Inline keyboard URL buttons route to `check`.
- None of these cases downloads the video thumbnail.

### R3. No full video download

The application must never call `getFile` or `downloadFileAsDataUrl` for the video file id in this feature.

Acceptance criteria:

- Only thumbnail file ids may reach `handleImage`.
- Video messages without thumbnail continue to use the existing unsupported-media fallback.

### R4. Privacy and safety boundaries

Thumbnail analysis reuses the existing image privacy path.

Acceptance criteria:

- Download is in memory only through `handleImage`.
- Existing image size limits, QR decoding limits and OCR fallback behavior apply unchanged.
- Raw image/video bytes are not persisted.

### R5. User experience

If a thumbnail is readable, users get a normal risk result instead of a dead-end video fallback. If it is unreadable, the existing image fallback should ask for a clearer screenshot, link, QR target or short description.

Acceptance criteria:

- A video thumbnail containing scam text can produce a risk result.
- A video without thumbnail still receives media-specific capture instructions.
