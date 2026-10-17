# Submission worker. The build context mirrors the repo: worker/, lib/ats/, lib/applications.ts and lib/utils.ts
# (the worker imports them as ../../lib/*). Build it with scripts/stage.sh, or from
# the repo root with: docker build -f worker/Dockerfile .
FROM mcr.microsoft.com/playwright:v1.61.1-noble

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8080

WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY lib/ats /app/lib/ats
COPY lib/applications.ts lib/utils.ts /app/lib/
COPY worker/src ./src

USER pwuser
EXPOSE 8080
CMD ["npx", "tsx", "src/main.ts"]
