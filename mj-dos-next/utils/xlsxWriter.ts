// Minimal .xlsx (OOXML) writer using STORE-only ZIP encoding.
// No third-party dependencies. Produces a valid workbook openable by Excel,
// Numbers, LibreOffice, and Google Sheets.

export type XlsxCell = string | number | null | undefined;
export type XlsxRow = XlsxCell[];

export interface XlsxColumn {
  width?: number;
}

export interface XlsxSheet {
  name: string;
  rows: XlsxRow[];
  columns?: XlsxColumn[];
  merges?: string[];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellRef(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function buildSheetXml(sheet: XlsxSheet): string {
  const rowsXml = sheet.rows.map((row, r) => {
    const cellsXml = row.map((val, c) => {
      const ref = cellRef(r, c);
      if (val === null || val === undefined || val === '') {
        return `<c r="${ref}"/>`;
      }
      if (typeof val === 'number' && Number.isFinite(val)) {
        return `<c r="${ref}"><v>${val}</v></c>`;
      }
      const text = escapeXml(String(val));
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cellsXml}</row>`;
  }).join('');

  const colsXml = sheet.columns && sheet.columns.length
    ? `<cols>${sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 15}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const mergesXml = sheet.merges && sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}</worksheet>`;
}

function buildWorkbookXml(sheets: XlsxSheet[]): string {
  const sheetsXml = sheets.map((s, i) => {
    const name = escapeXml(s.name);
    return `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetsXml}</sheets></workbook>`;
}

function buildWorkbookRels(sheets: XlsxSheet[]): string {
  const rels = sheets.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function buildContentTypes(sheets: XlsxSheet[]): string {
  const overrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),           // version needed
      u16(0),            // flags
      u16(0),            // method: STORE
      u16(0),            // mod time
      u16(0x21),         // mod date (arbitrary)
      u32(crc),
      u32(size),         // compressed size
      u32(size),         // uncompressed size
      u16(nameBytes.length),
      u16(0),            // extra length
      nameBytes,
      entry.data,
    ]);
    localChunks.push(localHeader);

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),           // version made by
      u16(20),           // version needed
      u16(0),            // flags
      u16(0),            // method: STORE
      u16(0),
      u16(0x21),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),            // extra length
      u16(0),            // comment length
      u16(0),            // disk number
      u16(0),            // internal attrs
      u32(0),            // external attrs
      u32(offset),       // local header offset
      nameBytes,
    ]);
    centralChunks.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const endOfCentral = concatBytes([
    u32(0x06054b50),
    u16(0),                            // disk number
    u16(0),                            // disk with central dir
    u16(entries.length),               // entries on this disk
    u16(entries.length),               // total entries
    u32(centralDirectory.length),      // central dir size
    u32(offset),                       // central dir offset
    u16(0),                            // comment length
  ]);

  return concatBytes([...localChunks, centralDirectory, endOfCentral]);
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (!sheets.length) throw new Error('At least one sheet is required');
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encode(buildContentTypes(sheets)) },
    { name: '_rels/.rels', data: encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encode(buildWorkbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encode(buildWorkbookRels(sheets)) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: encode(buildSheetXml(s)),
    })),
  ];
  return buildZip(entries);
}

export function downloadXlsx(sheets: XlsxSheet[], fileName: string): void {
  const bytes = buildXlsx(sheets);
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
