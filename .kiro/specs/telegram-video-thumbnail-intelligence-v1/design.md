# Design: Telegram Video Thumbnail Intelligence v1

## Overview

Telegram may include a small `PhotoSize` object on `message.video.thumbnail`. That image is enough for common forwarded promo videos where the first frame contains a QR, username, betting link, "free spins", NFT reward, wallet action or APK prompt. This feature treats that thumbnail as an ordinary image input while keeping full video processing out of scope.

## Architecture

The change is entirely in the Telegram update router:

1. Parse `message.video` as a structured object instead of `unknown`.
2. Keep the current priority: callback > command > active scenario > text/caption/button evidence > images/media.
3. If a video has no textual evidence and has `thumbnail.file_id`, return `{ kind: "image", fileId: thumbnail.file_id }`.
4. Dispatch stays unchanged: `dispatchUpdate` already sends `image` actions to `handleImage`.

## Data Models

```ts
type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
};

type TelegramVideoEvidence = {
  file_id?: string;
  file_size?: number;
  duration?: number;
  thumbnail?: TelegramPhotoSize;
  thumb?: TelegramPhotoSize; // defensive legacy compatibility
};
```

## Error Handling

- If the thumbnail is missing, the old unsupported-media guidance is used.
- If `getFile` or the download fails for the thumbnail, `handleImage` returns the existing OCR/QR fallback.
- If the thumbnail is too large, the existing image-too-large response is used.
- The router never routes the video file id itself to image handling.

## Testing Strategy

- Router unit tests:
  - video thumbnail routes as image;
  - video caption has priority over thumbnail;
  - inline keyboard URL has priority over thumbnail;
  - video without thumbnail remains out-of-scope.
- Webhook integration tests:
  - video thumbnail goes through `getFile`/download/OCR with the thumbnail id only;
  - video file id is never fetched;
  - video caption does not download the thumbnail.
