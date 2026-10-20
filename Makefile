# AI4Democracy map — build and deploy
#
#   make build       production build into dist/
#   make worker-dev  Worker + local D1 on :8787
#   make deploy-cf   ship the Worker and static assets to Cloudflare

.PHONY: build worker-dev deploy-cf

# SITE_URL bakes absolute og:url/og:image into index.html; unset strips them.
SITE_URL ?= https://ai4democracy.world

build:
	SITE_URL=$(SITE_URL) bun run build

worker-dev:
	cd worker && npx wrangler d1 execute ai4democracy --local --file=schema.sql
	cd worker && npx wrangler dev

# Mirrors .github/workflows/deploy.yml.
# `wrangler deploy` fails with 10034 (workers.dev subdomain call); the versions API skips it.
# Routes and cron triggers are not applied this way; they persist on the script.
deploy-cf: build
	cd worker && npx wrangler d1 execute ai4democracy --remote --yes --file=schema.sql
	cd worker && id=$$(npx wrangler versions upload 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | sed -n 's/.*Worker Version ID: \([0-9a-f-]*\).*/\1/p') && \
		test -n "$$id" && npx wrangler versions deploy "$$id@100%" --yes
