import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'lobby-pr.com'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-posta', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('E-posta ve şifre gereklidir')
        }

        const email = credentials.email as string
        const password = credentials.password as string

        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          throw new Error(`Sadece @${ALLOWED_DOMAIN} e-posta adresleri kabul edilmektedir`)
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          throw new Error('E-posta adresi veya şifre hatalı')
        }

        if (!user.isActive) {
          throw new Error('Hesabınız devre dışı bırakılmıştır. Lütfen yöneticiyle iletişime geçin.')
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          throw new Error('E-posta adresi veya şifre hatalı')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          avatar: user.avatar ?? undefined,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.department = (user as any).department
        token.avatar = (user as any).avatar
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.department = token.department as string
        session.user.avatar = token.avatar as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
})
