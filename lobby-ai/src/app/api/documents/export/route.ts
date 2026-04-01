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
import pptxgen from 'pptxgenjs'
import * as XLSX from 'xlsx'

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

    if (format === 'pptx') {
      const prs = new pptxgen()
      prs.layout = 'LAYOUT_WIDE'
      prs.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' }

      // Kapak slaytı
      const coverSlide = prs.addSlide()
      coverSlide.background = { color: '1B2A4A' }
      coverSlide.addText(doc.title, {
        x: '5%', y: '35%', w: '90%', h: '20%',
        fontSize: 32, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
      })
      if (doc.client) {
        coverSlide.addText(doc.client.name, {
          x: '5%', y: '57%', w: '90%', h: '8%',
          fontSize: 18, color: 'E87722', align: 'center',
        })
      }
      coverSlide.addText('Lobby İletişim', {
        x: '5%', y: '85%', w: '90%', h: '6%',
        fontSize: 12, color: 'AAAAAA', align: 'center',
      })

      // HTML içeriğinden slaytlar oluştur
      const plainText = doc.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const h1Matches = [...doc.content.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)]
      const h2Matches = [...doc.content.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)]

      if (h1Matches.length > 0 || h2Matches.length > 0) {
        // Başlık bazlı slayt oluşturma
        const allHeadings = [
          ...h1Matches.map(m => ({ level: 1, text: m[1].replace(/<[^>]*>/g, '').trim(), index: m.index || 0 })),
          ...h2Matches.map(m => ({ level: 2, text: m[1].replace(/<[^>]*>/g, '').trim(), index: m.index || 0 })),
        ].sort((a, b) => a.index - b.index)

        for (let i = 0; i < allHeadings.length; i++) {
          const heading = allHeadings[i]
          const nextIndex = allHeadings[i + 1]?.index ?? doc.content.length
          const sectionHtml = doc.content.slice(heading.index, nextIndex)
          const sectionText = sectionHtml
            .replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, '')
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400)

          const slide = prs.addSlide()
          slide.addText(heading.text, {
            x: '5%', y: '5%', w: '90%', h: '15%',
            fontSize: heading.level === 1 ? 28 : 22,
            bold: true, color: '1B2A4A', valign: 'middle',
          })
          slide.addShape(prs.ShapeType.rect, {
            x: '5%', y: '21%', w: '15%', h: '1%',
            fill: { color: 'E87722' }, line: { color: 'E87722' },
          })
          if (sectionText) {
            slide.addText(sectionText, {
              x: '5%', y: '25%', w: '90%', h: '65%',
              fontSize: 14, color: '333333', valign: 'top', wrap: true,
            })
          }
        }
      } else {
        // Başlık yoksa tek slayt
        const slide = prs.addSlide()
        slide.addText(doc.title, {
          x: '5%', y: '5%', w: '90%', h: '15%',
          fontSize: 24, bold: true, color: '1B2A4A',
        })
        slide.addText(plainText.slice(0, 500), {
          x: '5%', y: '25%', w: '90%', h: '65%',
          fontSize: 14, color: '333333', wrap: true,
        })
      }

      const pptxBuffer = await prs.write({ outputType: 'nodebuffer' }) as Buffer

      await prisma.activity.create({
        data: { type: 'document_exported', userId: session.user.id!, documentId, metadata: { format: 'pptx' } },
      })
      await prisma.document.update({ where: { id: documentId }, data: { status: 'EXPORTED' } })

      return new NextResponse(pptxBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.pptx"`,
        },
      })
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()

      // Ana içerik sayfası
      const plainLines = doc.content
        .replace(/<\/p>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ').replace(/<[^>]*>/g, '')
        .split('\n').map(l => l.trim()).filter(Boolean)

      const contentData = plainLines.map(line => [line])
      const wsContent = XLSX.utils.aoa_to_sheet([[doc.title], [''], ...contentData])
      wsContent['!cols'] = [{ wch: 100 }]
      XLSX.utils.book_append_sheet(wb, wsContent, 'İçerik')

      // Bilgi sayfası
      const infoData = [
        ['Alan', 'Değer'],
        ['Doküman Adı', doc.title],
        ['Müşteri', doc.client?.name || '-'],
        ['Oluşturan', doc.author.name],
        ['Tarih', new Date().toLocaleDateString('tr-TR')],
      ]
      const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
      wsInfo['!cols'] = [{ wch: 20 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Bilgi')

      const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      await prisma.activity.create({
        data: { type: 'document_exported', userId: session.user.id!, documentId, metadata: { format: 'xlsx' } },
      })

      return new NextResponse(xlsxBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.xlsx"`,
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
