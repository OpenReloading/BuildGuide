FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579

# uv for the MkDocs plugin (the image has Python 3.12 without pip or venv); same version as setup-uv in CI
COPY --from=ghcr.io/astral-sh/uv:0.13.4@sha256:9f130421e930bfbdc563c00740466603f8723158e90297d07957c2294640262b /uv /uvx /usr/local/bin/
# the cache and the workspace are on different file systems
ENV UV_LINK_MODE=copy

USER ubuntu
