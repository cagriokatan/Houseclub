import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
} from 'docx'

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []

  // Basit HTML → DOCX dönüşümü
  const cleanHtml = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')

  const lines = cleanHtml
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Başlık satırlarını tespit et (HTML'den al)
  const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []
  const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || []
  const h3Matches = html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || []

  const h1Texts = h1Matches.map((m) => m.replace(/<[^>]*>/g, '').trim())
  const h2Texts = h2Matches.map((m) => m.replace(/<[^>]*>/g, '').trim())
  const h3Texts = h3Matches.map((m) => m.replace(/<[^>]*>/g, '').trim())

  for (const line of lines) {
    if (h1Texts.includes(line)) {
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 150 },
        })
      )
    } else if (h2Texts.includes(line)) {
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      )
    } else if (h3Texts.includes(line)) {
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      )
    } else if (line.startsWith('• ')) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: 'Calibri', size: 23 })],
          spacing: { before: 60, after: 60 },
          indent: { left: 360 },
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: 'Calibri', size: 23 })],
          spacing: { before: 80, after: 80 },
          alignment: AlignmentType.JUSTIFIED,
        })
      )
    }
  }

  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  try {
    const { documentId, format } = await req.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Doküman ID gereklidir' }, { status: 400 })
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: { select: { name: true } },
        client: { select: { name: true } },
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 })
    }

    if (format === 'docx') {
      const contentParagraphs = htmlToDocxParagraphs(doc.content)

      const docx = new DocxDocument({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 24 },
              paragraph: { spacing: { line: 276 } }, // 1.15 satır aralığı
            },
          },
        },
        sections: [
          {
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'LOBBY İLETİŞİM',
                        bold: true,
                        font: 'Calibri',
                        size: 18,
                        color: '1B2A4A',
                      }),
                      new TextRun({
                        text: doc.client ? `  |  ${doc.client.name}` : '',
                        font: 'Calibri',
                        size: 18,
                        color: '666666',
                      }),
                    ],
                    border: {
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E87722' },
                    },
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${doc.title}  |  Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`,
                        font: 'Calibri',
                        size: 16,
                        color: '999999',
                      }),
                    ],
                  }),
                ],
              }),
            },
            children: [
              // Başlık
              new Paragraph({
                children: [
                  new TextRun({
                    text: doc.title,
                    bold: true,
                    font: 'Calibri',
                    size: 36,
                    color: '1B2A4A',
                  }),
                ],
                spacing: { before: 0, after: 400 },
              }),
              // İçerik
              ...contentParagraphs,
            ],
          },
        ],
      })

      const buffer = await Packer.toBuffer(docx)
      const uint8array = new Uint8Array(buffer)

      // Aktivite kaydı
      await prisma.activity.create({
        data: {
          type: 'document_exported',
          userId: session.user.id!,
          documentId,
          metadata: { format: 'docx' },
        },
      })

      // Doküman durumunu güncelle
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'EXPORTED' },
      })

      return new NextResponse(uint8array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.docx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Desteklenmeyen format' }, { status: 400 })
  } catch (error) {
    console.error('Export hatası:', error)
    return NextResponse.json(
      { error: 'Dışa aktarma sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
