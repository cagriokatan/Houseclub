import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      department: string
      avatar?: string
    } & DefaultSession['user']
  }

  interface User {
    role: string
    department: string
    avatar?: string
  }
}
