import io
from pathlib import Path
import re
from xml.sax.saxutils import escape
import zipfile

from docx import Document
from docx.shared import Inches, Pt
from pypdf import PdfReader
import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def extract_upload(filename, content, long_document=False):
    suffix = Path(filename).suffix.lower()
    if len(content) > 10 * 1024 * 1024:
        raise ValueError('Please use a document smaller than 10 MB.')
    if suffix in ('.txt', '.md'):
        text = content.decode('utf-8-sig')
    elif suffix == '.pdf':
        reader = PdfReader(io.BytesIO(content))
        if len(reader.pages) > (300 if long_document else 60):
            raise ValueError('Use a document with at most 300 pages.' if long_document else 'Please upload a CV or career document under 60 pages.')
        text = '\n\n'.join(page.extract_text() or '' for page in reader.pages)
    elif suffix == '.docx':
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            if sum(i.file_size for i in archive.infolist()) > 40 * 1024 * 1024:
                raise ValueError('The expanded Word document is too large.')
        doc = Document(io.BytesIO(content))
        text = '\n'.join(p.text for p in doc.paragraphs)
        text += '\n' + '\n'.join(' | '.join(c.text for c in r.cells) for t in doc.tables for r in t.rows)
    else:
        raise ValueError('Use a PDF, Word (.docx), text or Markdown file.')
    if not text.strip():
        raise ValueError('No readable text was found. For scanned PDFs, paste the text instead.')
    if len(text) > (300000 if long_document else 50000):
        raise ValueError('This document has too much text. Import a shorter CV or paste the relevant sections.')
    return text.strip()


def plain(line):
    return re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line).replace('**', '').replace('`', '')


def export_docx(content):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = section.bottom_margin = Inches(.65)
    section.left_margin = section.right_margin = Inches(.75)
    style = doc.styles['Normal']
    style.font.name, style.font.size = 'Calibri', Pt(10.5)
    style.paragraph_format.space_after = Pt(5)
    for line in content.splitlines():
        if not line.strip():
            continue
        if line.startswith('#'):
            level = min(len(line) - len(line.lstrip('#')), 3)
            doc.add_heading(plain(line.lstrip('#').strip()), level=level)
        elif re.match(r'^\s*[-*] ', line):
            doc.add_paragraph(plain(re.sub(r'^\s*[-*] ', '', line)), style='List Bullet')
        else:
            doc.add_paragraph(plain(line))
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def export_pdf(content):
    fonts = Path(reportlab.__file__).parent / 'fonts'
    if 'JobVera' not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont('JobVera', str(fonts / 'Vera.ttf')))
        pdfmetrics.registerFont(TTFont('JobVeraBold', str(fonts / 'VeraBd.ttf')))
    glyphs = pdfmetrics.getFont('JobVera').face.charToGlyph
    missing = {c for c in plain(content) if not c.isspace() and ord(c) not in glyphs}
    if missing:
        raise ValueError('The PDF font does not support some characters in this document. Download Word instead to preserve its language and characters.')
    body = ParagraphStyle('body', fontName='JobVera', fontSize=10, leading=14, spaceAfter=5, alignment=TA_LEFT,
                          textColor=colors.HexColor('#222233'))
    heading = ParagraphStyle('heading', parent=body, fontName='JobVeraBold', fontSize=12, leading=16, spaceBefore=10,
                             spaceAfter=6, keepWithNext=True)
    title = ParagraphStyle('title', parent=heading, fontSize=20, leading=25, spaceBefore=0)
    bullet = ParagraphStyle('bullet', parent=body, leftIndent=10, firstLineIndent=-7)
    story = []
    for line in content.splitlines():
        if not line.strip():
            story.append(Spacer(1, 4))
        elif line.startswith('#'):
            story.append(Paragraph(escape(plain(line.lstrip('#').strip())), title if line.startswith('# ') else heading))
        elif re.match(r'^\s*[-*] ', line):
            story.append(Paragraph('• ' + escape(plain(re.sub(r'^\s*[-*] ', '', line))), bullet))
        else:
            story.append(Paragraph(escape(plain(line)), body))
    buffer = io.BytesIO()
    SimpleDocTemplate(buffer, pagesize=A4, leftMargin=48, rightMargin=48, topMargin=42, bottomMargin=42,
                      title='Application document', author='').build(story)
    data = buffer.getvalue()
    reader = PdfReader(io.BytesIO(data))
    if not reader.pages or not ''.join(p.extract_text() or '' for p in reader.pages).strip():
        raise ValueError('PDF text verification failed. Please download Word instead.')
    return data
