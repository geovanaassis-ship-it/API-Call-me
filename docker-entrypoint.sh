#!/bin/sh
set -e

echo "Aplicando migrações do banco de dados..."
npx prisma migrate deploy

if [ -n "$RI_ADMIN_EMAIL" ] && [ -n "$RI_ADMIN_PASSWORD" ]; then
  echo "Garantindo usuário de R.I. (seed)..."
  npm run seed
fi

exec "$@"
