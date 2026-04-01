'use client'

import { FileText, X, FileDown, Presentation, Sheet, Printer } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface DocumentPreviewProps {
  title: string
  content: string
  clientName?: string
  authorName?: string
  documentId: string
  onExport: (format: string) => void
  onClose: () => void
}

export function DocumentPreview({
  title,
  content,
  clientName,
  authorName,
  documentId: _documentId,
  onExport,
  onClose,
}: DocumentPreviewProps) {
  const today = formatDate(new Date())

  return (
    <div className="flex flex-col h-full bg-[#F0F0F2]">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#E87722]" />
          <span className="text-sm font-semibold text-[#1B2A4A]">Doküman Önizleme</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Export buttons */}
          <button
            onClick={() => onExport('docx')}
            title="Word olarak indir"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Word
          </button>
          <button
            onClick={() => onExport('pptx')}
            title="PowerPoint olarak indir"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Presentation className="w-3.5 h-3.5" />
            PPT
          </button>
          <button
            onClick={() => onExport('xlsx')}
            title="Excel olarak indir"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Sheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => onExport('pdf')}
            title="PDF olarak yazdır"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Önizlemeyi kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paper document */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="bg-white shadow-lg rounded-sm mx-auto"
          style={{ maxWidth: '720px', minHeight: '900px' }}
        >
          {/* Orange top bar */}
          <div className="h-1 w-full rounded-t-sm" style={{ backgroundColor: '#E87722' }} />

          {/* Document inner */}
          <div className="px-10 py-8">
            {/* Document header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#1B2A4A] uppercase">
                  LOBBY İLETİŞİM
                </p>
                {clientName && (
                  <p className="text-xs text-gray-500 mt-0.5">{clientName}</p>
                )}
              </div>
              <p className="text-xs text-gray-400">{today}</p>
            </div>

            {/* Title */}
            <h1
              className="font-bold mb-2 leading-tight"
              style={{ fontSize: '28px', color: '#1B2A4A' }}
            >
              {title}
            </h1>

            {/* Author & date */}
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
              {authorName && <span>{authorName}</span>}
              <span>{today}</span>
            </div>

            {/* Orange divider */}
            <div className="h-0.5 w-16 mb-6" style={{ backgroundColor: '#E87722' }} />

            {/* Content */}
            {content ? (
              <div
                className="doc-content"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">
                  AI ile sohbet ederek dokümanınızı oluşturun
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-300 tracking-wide">LOBBY İLETİŞİM</p>
              <div className="h-0.5 w-8" style={{ backgroundColor: '#E87722', opacity: 0.4 }} />
              <p className="text-xs text-gray-300">{today}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .doc-content h1 { font-size:1.75rem; font-weight:700; color:#1B2A4A; margin:1.5rem 0 0.75rem }
        .doc-content h2 { font-size:1.4rem; font-weight:600; color:#E87722; margin:1.25rem 0 0.5rem }
        .doc-content h3 { font-size:1.15rem; font-weight:600; color:#374151; margin:1rem 0 0.4rem }
        .doc-content p { margin-bottom:0.875rem; line-height:1.75; color:#374151; text-align:justify }
        .doc-content ul { list-style:disc; padding-left:1.5rem; margin-bottom:0.875rem }
        .doc-content ol { list-style:decimal; padding-left:1.5rem; margin-bottom:0.875rem }
        .doc-content li { margin-bottom:0.3rem; line-height:1.6; color:#374151 }
        .doc-content strong { font-weight:700; color:#1B2A4A }
        .doc-content em { font-style:italic }
        .doc-content hr { border:none; border-top:2px solid #E87722; margin:1.5rem 0 }
        .doc-content table { width:100%; border-collapse:collapse; margin:1rem 0 }
        .doc-content th { background:#1B2A4A; color:white; font-weight:600; padding:8px 12px; text-align:left; border:1px solid #e5e7eb }
        .doc-content td { padding:8px 12px; border:1px solid #e5e7eb; color:#374151 }
        .doc-content blockquote { border-left:4px solid #E87722; padding-left:1rem; color:#6b7280; font-style:italic; margin:1rem 0 }
      `}</style>
    </div>
  )
}
