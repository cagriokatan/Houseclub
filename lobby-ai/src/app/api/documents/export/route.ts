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

// HTML içeriğini parçalayarak inline formatlamayı (bold, italic) koruyarak TextRun'lar oluşturur
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []
  // <strong> ve <em> tag'lerini parse et
  const regex = /<strong>(.*?)<\/strong>|<em>(.*?)<\/em>|([^<]+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      runs.push(new TextRun({ text: match[1], bold: true, font: 'Calibri', size: 23 }))
    } else if (match[2] !== undefined) {
      runs.push(new TextRun({ text: match[2], italics: true, font: 'Calibri', size: 23 }))
    } else if (match[3] !== undefined) {
      const clean = match[3].replace(/<[^>]*>/g, '').trim()
      if (clean) runs.push(new TextRun({ text: clean, font: 'Calibri', size: 23 }))
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text: text.replace(/<[^>]*>/g, ''), font: 'Calibri', size: 23 })]
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []

  // HTML'i satır satır parse et
  const segments = html
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/(<h[1-3][^>]*>.*?<\/h[1-3]>|<li[^>]*>.*?<\/li>|<hr[^>]*>|<p[^>]*>.*?<\/p>|<table[\s\S]*?<\/table>)/gi)
    .filter(s => s.trim())

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    // Başlık 1
    const h1Match = trimmed.match(/<h1[^>]*>(.*?)<\/h1>/i)
    if (h1Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h1Match[1].replace(/<[^>]*>/g, ''), font: 'Calibri', size: 32, bold: true, color: '1B2A4A' })],
        spacing: { before: 360, after: 180 },
      }))
      continue
    }

    // Başlık 2
    const h2Match = trimmed.match(/<h2[^>]*>(.*?)<\/h2>/i)
    if (h2Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h2Match[1].replace(/<[^>]*>/g, ''), font: 'Calibri', size: 26, bold: true, color: 'E87722' })],
        spacing: { before: 300, after: 140 },
      }))
      continue
    }

    // Başlık 3
    const h3Match = trimmed.match(/<h3[^>]*>(.*?)<\/h3>/i)
    if (h3Match) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h3Match[1].replace(/<[^>]*>/g, ''), font: 'Calibri', size: 24, bold: true, color: '374151' })],
        spacing: { before: 240, after: 120 },
      }))
      continue
    }

    // Yatay çizgi
    if (/<hr/i.test(trimmed)) {
      paragraphs.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E87722' } },
        spacing: { before: 200, after: 200 },
      }))
      continue
    }

    // Liste öğesi
    const liMatch = trimmed.match(/<li[^>]*>(.*?)<\/li>/i)
    if (liMatch) {
      const text = liMatch[1].replace(/<[^>]*>/g, '').trim()
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: '    \u2022  ', font: 'Calibri', size: 23, color: 'E87722' }),
          ...parseInlineFormatting(liMatch[1]),
        ],
        spacing: { before: 40, after: 40 },
        indent: { left: 400 },
      }))
      continue
    }

    // Paragraf (inline formatlama korunarak)
    const pMatch = trimmed.match(/<p[^>]*>(.*?)<\/p>/is)
    const content = pMatch ? pMatch[1] : trimmed
    const cleanContent = content.replace(/<br\s*\/?>/gi, '\n').trim()
    if (!cleanContent || cleanContent === '&nbsp;') continue

    // Satır satır işle
    const lines = cleanContent.split('\n')
    for (const line of lines) {
      const lt = line.trim()
      if (!lt) continue
      paragraphs.push(new Paragraph({
        children: parseInlineFormatting(lt),
        spacing: { before: 80, after: 80 },
        alignment: AlignmentType.JUSTIFIED,
      }))
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
      const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

      const docx = new DocxDocument({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 23 },
              paragraph: { spacing: { line: 300 } },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 },
              },
            },
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'LOBBY ', bold: true, font: 'Calibri', size: 20, color: '1B2A4A' }),
                      new TextRun({ text: 'İLETİŞİM', bold: true, font: 'Calibri', size: 20, color: 'E87722' }),
                      new TextRun({ text: doc.client ? `    |    ${doc.client.name}` : '', font: 'Calibri', size: 18, color: '888888' }),
                    ],
                    border: {
                      bottom: { style: BorderStyle.SINGLE, size: 8, color: 'E87722', space: 8 },
                    },
                    spacing: { after: 200 },
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Lobby İletişim', font: 'Calibri', size: 16, color: '888888', italics: true }),
                      new TextRun({ text: `    |    ${today}    |    `, font: 'Calibri', size: 16, color: 'AAAAAA' }),
                      new TextRun({ text: doc.author.name, font: 'Calibri', size: 16, color: '888888' }),
                    ],
                    border: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 8 },
                    },
                  }),
                ],
              }),
            },
            children: [
              // Doküman başlığı
              new Paragraph({
                children: [
                  new TextRun({ text: doc.title, bold: true, font: 'Calibri', size: 40, color: '1B2A4A' }),
                ],
                spacing: { before: 0, after: 120 },
              }),
              // Alt bilgi: müşteri + tarih
              new Paragraph({
                children: [
                  ...(doc.client ? [new TextRun({ text: doc.client.name, font: 'Calibri', size: 22, color: 'E87722', bold: true }), new TextRun({ text: '    |    ', font: 'Calibri', size: 22, color: 'CCCCCC' })] : []),
                  new TextRun({ text: today, font: 'Calibri', size: 22, color: '888888' }),
                ],
                spacing: { after: 120 },
              }),
              // Turuncu ayraç çizgi
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'E87722' } },
                spacing: { after: 400 },
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
