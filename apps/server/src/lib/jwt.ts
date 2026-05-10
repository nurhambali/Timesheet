import { jwt } from '@elysiajs/jwt'

export const jwtConfig = jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
})
