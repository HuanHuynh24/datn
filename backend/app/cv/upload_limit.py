"""Bound the multipart body before parsing/spooling, including chunked requests."""

from fastapi.responses import JSONResponse


class CVUploadLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != ("/api/v1/candidates/me/cvs")
        ):
            return await self.app(scope, receive, send)
        # Buffer a bounded request before passing it to Starlette's multipart parser.
        # One MiB is reserved for multipart headers; file validation still enforces 10 MiB.
        limit = 11 * 1024 * 1024
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            total += len(message.get("body", b""))
            if total > limit:
                return await JSONResponse(
                    {"detail": "CV upload request exceeds limit"}, status_code=413
                )(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body", False):
                break
        index = 0

        async def bounded_receive():
            nonlocal index
            if index < len(chunks):
                message = chunks[index]
                index += 1
                return message
            return await receive()

        await self.app(scope, bounded_receive, send)
