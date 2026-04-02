import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
} from 'docx'
import pptxgen from 'pptxgenjs'
import * as XLSX from 'xlsx'

// ─── Brand colors ─────────────────────────────────────────────────────────────

const NAVY   = '1B2A4A'
const ORANGE = 'E87722'
const GRAY   = '374151'
const LGRAY  = '9CA3AF'
const WHITE  = 'FFFFFF'

// ─── HTML utilities ───────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/** Convert inline HTML (bold / italic / br) to docx TextRun array */
function parseInline(
  html: string,
  opts: { font?: string; size?: number; color?: string } = {},
): TextRun[] {
  const { font = 'Calibri', size = 22, color } = opts
  const runs: TextRun[] = []

  // Split at <strong>, <em>, <br> boundaries
  const parts = html.split(/(<strong>[\s\S]*?<\/strong>|<em>[\s\S]*?<\/em>|<br\s*\/?>)/gi)

  for (const part of parts) {
    if (!part) continue
    if (/^<strong>([\s\S]*?)<\/strong>$/i.test(part)) {
      const text = stripTags(part)
      if (text) runs.push(new TextRun({ text, bold: true, font, size, ...(color ? { color } : {}) }))
    } else if (/^<em>([\s\S]*?)<\/em>$/i.test(part)) {
      const text = stripTags(part)
      if (text) runs.push(new TextRun({ text, italics: true, font, size, ...(color ? { color } : {}) }))
    } else if (/^<br/i.test(part)) {
      runs.push(new TextRun({ break: 1 }))
    } else {
      const text = stripTags(part)
      if (text) runs.push(new TextRun({ text, font, size, ...(color ? { color } : {}) }))
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: '', font, size })]
}

// ─── HTML → DOCX paragraphs ───────────────────────────────────────────────────

type DocxChild = Paragraph | Table

function htmlToDocxChildren(html: string): DocxChild[] {
  const children: DocxChild[] = []

  // Match every block-level element in source order
  const blockRe =
    /<(h[1-3]|p|ul|ol|table|blockquote)([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi

  let matched = false
  let m: RegExpExecArray | null

  while ((m = blockRe.exec(html)) !== null) {
    matched = true
    const tag   = (m[1] ?? 'hr').toLowerCase()
    const inner = (m[3] ?? '').trim()

    switch (tag) {
      case 'h1':
        children.push(new Paragraph({
          children: [new TextRun({ text: stripTags(inner), bold: true, font: 'Calibri', size: 36, color: NAVY })],
          spacing: { before: 440, after: 200 },
        }))
        break

      case 'h2':
        children.push(new Paragraph({
          children: [new TextRun({ text: stripTags(inner), bold: true, font: 'Calibri', size: 28, color: ORANGE })],
          spacing: { before: 320, after: 160 },
        }))
        break

      case 'h3':
        children.push(new Paragraph({
          children: [new TextRun({ text: stripTags(inner), bold: true, font: 'Calibri', size: 24, color: GRAY })],
          spacing: { before: 240, after: 120 },
        }))
        break

      case 'p': {
        const text = inner.replace(/<br\s*\/?>/gi, '\n').trim()
        if (text && text !== '&nbsp;') {
          children.push(new Paragraph({
            children: parseInline(inner, { size: 22 }),
            spacing: { before: 80, after: 80 },
            alignment: AlignmentType.JUSTIFIED,
          }))
        }
        break
      }

      case 'ul':
      case 'ol': {
        const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        items.forEach((li, idx) => {
          const bullet = tag === 'ul' ? '\u2022' : `${idx + 1}.`
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${bullet}  `, font: 'Calibri', size: 22, color: ORANGE, bold: true }),
              ...parseInline(li[1], { size: 22 }),
            ],
            spacing: { before: 60, after: 60 },
            indent: { left: 440 },
          }))
        })
        break
      }

      case 'table': {
        const ths  = [...inner.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
        const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]

        const tableRows: TableRow[] = []

        if (ths.length > 0) {
          tableRows.push(new TableRow({
            children: ths.map(th => new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: stripTags(th[1]), bold: true, font: 'Calibri', size: 19, color: WHITE })],
                spacing: { before: 60, after: 60 },
                alignment: AlignmentType.LEFT,
              })],
              shading: { fill: NAVY, type: ShadingType.SOLID, color: NAVY },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 140, right: 140 },
            })),
            tableHeader: true,
          }))
        }

        for (const tr of rows) {
          const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          if (tds.length === 0) continue
          tableRows.push(new TableRow({
            children: tds.map(td => new TableCell({
              children: [new Paragraph({
                children: parseInline(td[1], { size: 19 }),
                spacing: { before: 40, after: 40 },
              })],
              margins: { top: 40, bottom: 40, left: 140, right: 140 },
            })),
          }))
        }

        if (tableRows.length > 0) {
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }))
        }
        break
      }

      case 'blockquote':
        children.push(new Paragraph({
          children: parseInline(inner, { size: 22, color: '6B7280' }),
          indent: { left: 600 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: ORANGE } },
          spacing: { before: 100, after: 100 },
        }))
        break

      case 'hr':
        children.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
          spacing: { before: 200, after: 200 },
        }))
        break
    }
  }

  // Fallback: plain text lines
  if (!matched) {
    const plainText = stripTags(html)
    for (const line of plainText.split('\n')) {
      const t = line.trim()
      if (t) children.push(new Paragraph({
        children: [new TextRun({ text: t, font: 'Calibri', size: 22 })],
        spacing: { before: 80, after: 80 },
        alignment: AlignmentType.JUSTIFIED,
      }))
    }
  }

  return children.length > 0 ? children : [new Paragraph({ children: [] })]
}

// ─── PPTX: extract slides from HTML ──────────────────────────────────────────

interface SlideData {
  title: string
  subtitle?: string
  bullets: string[]
  bodyText: string
  hasBullets: boolean
}

function extractSlides(html: string, docTitle: string): SlideData[] {
  const slides: SlideData[] = []

  // Split content at every H1 boundary
  const h1Splits = [...html.matchAll(/<h1[^>]*>[\s\S]*?<\/h1>/gi)]

  if (h1Splits.length === 0) {
    // No H1: single content slide
    const bullets = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => stripTags(m[1]))
    const paras   = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => stripTags(m[1])).filter(Boolean)
    slides.push({
      title: docTitle,
      bullets,
      bodyText: paras.join(' ').slice(0, 350),
      hasBullets: bullets.length > 0,
    })
    return slides
  }

  // Build sections: for each H1, collect everything until next H1
  const positions = h1Splits.map(m => ({ index: m.index ?? 0, len: m[0].length, title: stripTags(m[0]) }))

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i].len
    const end   = positions[i + 1]?.index ?? html.length
    const title = positions[i].title
    const section = html.slice(start, end)

    // H2 → subtitle
    const h2 = section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    const subtitle = h2 ? stripTags(h2[1]) : undefined

    // Lists → bullets
    const bullets = [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(m => stripTags(m[1]))
      .filter(Boolean)

    // Paragraphs → body text (when no bullets)
    const paras = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => stripTags(m[1]))
      .filter(Boolean)
    const bodyText = paras.join(' ').slice(0, 350)

    slides.push({ title, subtitle, bullets, bodyText, hasBullets: bullets.length > 0 })
  }

  return slides
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  try {
    const { documentId, format } = await req.json()

    if (!documentId) return NextResponse.json({ error: 'Doküman ID gereklidir' }, { status: 400 })

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: { select: { name: true } },
        client: { select: { name: true } },
      },
    })
    if (!doc) return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 })

    const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

    // ── DOCX ─────────────────────────────────────────────────────────────────

    if (format === 'docx') {
      const contentChildren = htmlToDocxChildren(doc.content)

      const docx = new DocxDocument({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 22 },
              paragraph: { spacing: { line: 300 } },
            },
          },
        },
        sections: [
          {
            properties: {
              page: { margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 } },
            },
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'LOBBY ', bold: true, font: 'Calibri', size: 20, color: NAVY }),
                      new TextRun({ text: 'İLETİŞİM', bold: true, font: 'Calibri', size: 20, color: ORANGE }),
                      ...(doc.client
                        ? [new TextRun({ text: `    ·    ${doc.client.name}`, font: 'Calibri', size: 18, color: LGRAY })]
                        : []),
                    ],
                    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ORANGE, space: 8 } },
                    spacing: { after: 160 },
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Lobby İletişim', font: 'Calibri', size: 16, color: LGRAY, italics: true }),
                      new TextRun({ text: `    ·    ${today}    ·    `, font: 'Calibri', size: 16, color: 'D1D5DB' }),
                      new TextRun({ text: doc.author.name, font: 'Calibri', size: 16, color: LGRAY }),
                    ],
                    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 8 } },
                  }),
                ],
              }),
            },
            children: [
              // Title
              new Paragraph({
                children: [new TextRun({ text: doc.title, bold: true, font: 'Calibri', size: 44, color: NAVY })],
                spacing: { before: 0, after: 120 },
              }),
              // Meta line
              new Paragraph({
                children: [
                  ...(doc.client
                    ? [
                        new TextRun({ text: doc.client.name, font: 'Calibri', size: 22, color: ORANGE, bold: true }),
                        new TextRun({ text: '    ·    ', font: 'Calibri', size: 22, color: 'D1D5DB' }),
                      ]
                    : []),
                  new TextRun({ text: today, font: 'Calibri', size: 22, color: LGRAY }),
                ],
                spacing: { after: 120 },
              }),
              // Orange divider
              new Paragraph({
                children: [],
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE } },
                spacing: { after: 440 },
              }),
              // Content
              ...contentChildren,
            ],
          },
        ],
      })

      const buffer = await Packer.toBuffer(docx)

      await prisma.activity.create({
        data: { type: 'document_exported', userId: session.user.id!, documentId, metadata: { format: 'docx' } },
      })
      await prisma.document.update({ where: { id: documentId }, data: { status: 'EXPORTED' } })

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.docx"`,
        },
      })
    }

    // ── PPTX ─────────────────────────────────────────────────────────────────

    if (format === 'pptx') {
      const prs = new pptxgen()
      prs.layout = 'LAYOUT_WIDE'      // 10 × 7.5 in

      const slideList = extractSlides(doc.content, doc.title)

      // ── Cover slide ──────────────────────────────────────────────────────
      const cover = prs.addSlide()
      cover.background = { color: NAVY }

      // Top orange line
      cover.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })
      // LOBBY İLETİŞİM brand
      cover.addText('LOBBY İLETİŞİM', {
        x: 0.5, y: 0.3, w: 9, h: 0.45,
        fontFace: 'Calibri', fontSize: 13, bold: true, color: ORANGE, align: 'left',
      })
      // Horizontal separator
      cover.addShape(prs.ShapeType.rect, {
        x: 0.5, y: 0.85, w: 2.5, h: 0.04,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })
      // Document title
      cover.addText(doc.title, {
        x: 0.5, y: 1.3, w: 9, h: 3.2,
        fontFace: 'Calibri', fontSize: 38, bold: true, color: WHITE,
        align: 'left', valign: 'middle', wrap: true,
      })
      // Client
      if (doc.client) {
        cover.addText(doc.client.name.toUpperCase(), {
          x: 0.5, y: 4.7, w: 6, h: 0.5,
          fontFace: 'Calibri', fontSize: 15, color: ORANGE, bold: true, align: 'left',
        })
      }
      // Date + author
      cover.addText(`${today}   ·   ${doc.author.name}`, {
        x: 0.5, y: 5.3, w: 9, h: 0.35,
        fontFace: 'Calibri', fontSize: 11, color: '7B93B8', align: 'left',
      })
      // Bottom orange stripe
      cover.addShape(prs.ShapeType.rect, {
        x: 0, y: 7.44, w: '100%', h: 0.06,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })

      // ── Content slides ───────────────────────────────────────────────────
      for (const sd of slideList) {
        const slide = prs.addSlide()
        slide.background = { color: WHITE }

        // Navy header bar
        slide.addShape(prs.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: 1.2,
          fill: { color: NAVY }, line: { color: NAVY },
        })
        // Orange bottom-stripe on header
        slide.addShape(prs.ShapeType.rect, {
          x: 0, y: 1.2, w: '100%', h: 0.05,
          fill: { color: ORANGE }, line: { color: ORANGE },
        })
        // Slide title
        slide.addText(sd.title, {
          x: 0.45, y: 0.1, w: 9.1, h: 1.0,
          fontFace: 'Calibri', fontSize: 22, bold: true, color: WHITE,
          align: 'left', valign: 'middle',
        })

        // Lobby watermark bottom right
        slide.addText('Lobby İletişim', {
          x: 7.6, y: 7.15, w: 2.2, h: 0.28,
          fontFace: 'Calibri', fontSize: 8, color: 'CCCCCC', italic: true, align: 'right',
        })

        let yPos = 1.45

        // Subtitle (H2)
        if (sd.subtitle) {
          slide.addText(sd.subtitle, {
            x: 0.45, y: yPos, w: 9.1, h: 0.42,
            fontFace: 'Calibri', fontSize: 14, bold: true, color: ORANGE, align: 'left',
          })
          yPos += 0.52
        }

        const availH = 7.15 - yPos - 0.1

        if (sd.hasBullets) {
          // Bullet points
          const items = sd.bullets.slice(0, 8).map((b) => ({
            text: b.length > 130 ? b.slice(0, 127) + '…' : b,
            options: {
              bullet: { type: 'bullet' as const },
              fontFace: 'Calibri',
              fontSize: 15,
              color: GRAY,
              paraSpaceAfter: 6,
            },
          }))
          slide.addText(items, {
            x: 0.45, y: yPos, w: 9.1, h: availH,
            fontFace: 'Calibri', fontSize: 15, color: GRAY,
            valign: 'top', wrap: true,
          })
        } else if (sd.bodyText) {
          slide.addText(sd.bodyText, {
            x: 0.45, y: yPos, w: 9.1, h: availH,
            fontFace: 'Calibri', fontSize: 15, color: GRAY,
            valign: 'top', wrap: true,
          })
        }
      }

      // ── Closing slide ────────────────────────────────────────────────────
      const end = prs.addSlide()
      end.background = { color: NAVY }
      end.addShape(prs.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })
      end.addShape(prs.ShapeType.rect, {
        x: 0, y: 7.44, w: '100%', h: 0.06,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })
      end.addText('Teşekkürler', {
        x: 0.5, y: 2.2, w: 9, h: 1.6,
        fontFace: 'Calibri', fontSize: 44, bold: true, color: WHITE, align: 'center', valign: 'middle',
      })
      end.addShape(prs.ShapeType.rect, {
        x: 3.8, y: 4.1, w: 2.4, h: 0.05,
        fill: { color: ORANGE }, line: { color: ORANGE },
      })
      end.addText('LOBBY İLETİŞİM', {
        x: 0.5, y: 4.35, w: 9, h: 0.45,
        fontFace: 'Calibri', fontSize: 14, bold: true, color: ORANGE, align: 'center',
      })

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

    // ── XLSX ─────────────────────────────────────────────────────────────────

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()

      // ── Check if content has a table ──────────────────────────────────────
      const tableMatch = doc.content.match(/<table[^>]*>([\s\S]*?)<\/table>/i)

      if (tableMatch) {
        // Export primary table as first sheet
        const tableHtml = tableMatch[1]
        const ths = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]))
        const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
          .map(tr => [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1])))
          .filter(r => r.length > 0)

        const sheetData = ths.length > 0 ? [ths, ...rows] : rows
        const ws = XLSX.utils.aoa_to_sheet(sheetData)
        ws['!cols'] = ths.map(() => ({ wch: 30 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Veri')
      }

      // ── Full content as plain text sheet ──────────────────────────────────
      const plainLines = doc.content
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)

      const contentData: string[][] = [[doc.title], [''], ...plainLines.map(l => [l])]
      const wsContent = XLSX.utils.aoa_to_sheet(contentData)
      wsContent['!cols'] = [{ wch: 100 }]
      XLSX.utils.book_append_sheet(wb, wsContent, 'İçerik')

      // ── Info sheet ───────────────────────────────────────────────────────
      const wsInfo = XLSX.utils.aoa_to_sheet([
        ['Alan', 'Değer'],
        ['Doküman Adı', doc.title],
        ['Müşteri', doc.client?.name ?? '-'],
        ['Oluşturan', doc.author.name],
        ['Tarih', today],
      ])
      wsInfo['!cols'] = [{ wch: 20 }, { wch: 60 }]
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
    const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: `Dışa aktarma hatası: ${msg}` }, { status: 500 })
  }
}
