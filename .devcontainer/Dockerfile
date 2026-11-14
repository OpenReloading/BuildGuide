FROM mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d

# uv for the MkDocs plugin (the image has Python 3.12 without pip or venv); same version as setup-uv in CI
COPY --from=ghcr.io/astral-sh/uv:0.13.4@sha256:9f130421e930bfbdc563c00740466603f8723158e90297d07957c2294640262b /uv /uvx /usr/local/bin/
# the cache and the workspace are on different file systems
ENV UV_LINK_MODE=copy

USER ubuntu
