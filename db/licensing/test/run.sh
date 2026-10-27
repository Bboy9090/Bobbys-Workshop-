#!/usr/bin/env bash
# Runs the licensing migration and its tests against a fresh local database.
# Requires a local PostgreSQL server and sudo access to the postgres OS user.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=bbw_license_test
sudo -u postgres dropdb --if-exists "$DB"
sudo -u postgres createdb "$DB"
# Pipe the files in so the postgres user does not need read access to the home directory.
cat 0001_licensing_hardening.sql | sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB"
cat test/0001_test.sql | sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB"
sudo -u postgres dropdb "$DB"
