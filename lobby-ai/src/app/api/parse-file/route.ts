import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Max characters returned to the AI (keep context manageable)
const MAX_CHARS = 8000

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const name   = file.name.toLowerCase()

    let text = ''

    if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.pptx')) {
      // Dynamic import to avoid SSR issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const officeParser = require('officeparser')

      text = await new Promise<string>((resolve, reject) => {
        officeParser.parseOfficeAsync(buffer, {
          outputErrorToConsole: false,
          newlineDelimiter: '\n',
        })
          .then((content: string) => resolve(content ?? ''))
          .catch((err: unknown) => reject(err))
      })
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // Use the already-installed xlsx package for spreadsheets
      const XLSX = await import('xlsx')
      const wb   = XLSX.read(buffer, { type: 'buffer' })
      const lines: string[] = []
      for (const sheetName of wb.SheetNames) {
        const ws   = wb.Sheets[sheetName]
        const csv  = XLSX.utils.sheet_to_csv(ws)
        lines.push(`[${sheetName}]\n${csv}`)
      }
      text = lines.join('\n\n')
    } else {
      // Plain text / markdown / csv etc.
      text = buffer.toString('utf-8')
    }

    return NextResponse.json({
      text: text.slice(0, MAX_CHARS),
      name: file.name,
      truncated: text.length > MAX_CHARS,
    })
  } catch (error) {
    console.error('Dosya ayrıştırma hatası:', error)
    const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: `Dosya okunamadı: ${msg}` }, { status: 500 })
  }
}
