import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use DIRECT connection for Prisma CLI (migrations/generate in CI)
    url: env('DIRECT_URL'),
  },
})
