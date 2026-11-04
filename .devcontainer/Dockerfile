FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f

# uv for the MkDocs plugin (the image has Python 3.12 without pip or venv); same version as setup-uv in CI
COPY --from=ghcr.io/astral-sh/uv:0.13.4@sha256:9f130421e930bfbdc563c00740466603f8723158e90297d07957c2294640262b /uv /uvx /usr/local/bin/
# the cache and the workspace are on different file systems
ENV UV_LINK_MODE=copy

USER ubuntu
