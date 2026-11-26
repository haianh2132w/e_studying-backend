import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export type ColKind = 'string' | 'number' | 'boolean' | 'date';

export interface Col {
    key: string;
    kind: ColKind;
    required?: boolean;
    note: string;
}

export interface RawRow {
    row: number; // số dòng trong Excel (dòng 1 là tiêu đề)
    values: Record<string, unknown>;
    errors: string[];
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_UNCOMPRESSED = 30 * 1024 * 1024;
const HARD_ROW_LIMIT = 5000;

// Cộng dung lượng giải nén khai báo trong thư mục trung tâm của file zip 
function zipUncompressedSize(b: Buffer): number {
    try {
        const min = Math.max(0, b.length - 22 - 0xffff);
        let eocd = -1;
        for (let i = b.length - 22; i >= min; i--) {
            if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('no eocd');
        const entries = b.readUInt16LE(eocd + 10);
        let offset = b.readUInt32LE(eocd + 16);
        let sum = 0;
        for (let n = 0; n < entries; n++) {
            if (b.readUInt32LE(offset) !== 0x02014b50) throw new Error('bad header');
            sum += b.readUInt32LE(offset + 24);
            offset += 46 + b.readUInt16LE(offset + 28) + b.readUInt16LE(offset + 30) + b.readUInt16LE(offset + 32);
        }
        return sum;
    } catch {
        throw new BadRequestException('File xlsx không hợp lệ');
    }
}

// 1. Kiểm tra file trước khi đọc 
export function validateXlsx(
    file?: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
    if (!file) throw new BadRequestException('Thiếu file (tên trường phải là file)');
    if (file.size === 0) throw new BadRequestException('File rỗng');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
        throw new BadRequestException('Chỉ nhận file .xlsx');
    }
    if (file.mimetype !== XLSX_MIME) throw new BadRequestException('Loại file (mime) không phải xlsx');
    const b = file.buffer;
    const isZip = b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
    if (!isZip) throw new BadRequestException('Nội dung file không phải xlsx');
    if (zipUncompressedSize(b) > MAX_UNCOMPRESSED) {
        throw new BadRequestException('File giải nén quá lớn');
    }
}

// 2. Đọc giá trị một ô 
type Plain = string | number | boolean | Date | null;

function plain(v: ExcelJS.CellValue): Plain {
    if (v === null || v === undefined) return null;
    if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return v;
    }
    if ('formula' in v || 'sharedFormula' in v) {
        throw new Error('ô chứa công thức, hãy dán giá trị thay vì công thức');
    }
    if ('error' in v) throw new Error('ô đang báo lỗi');
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return v.text; // ô dạng hyperlink
    return null;
}

function coerce(v: Exclude<Plain, null>, col: Col): { value?: unknown; error?: string } {
    switch (col.kind) {
        case 'string':
            return v instanceof Date ? { error: 'cần là văn bản, không phải ngày' } : { value: String(v).trim() };
        case 'number': {
            const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
            return Number.isNaN(n) ? { error: 'cần là số' } : { value: n };
        }
        case 'boolean': {
            if (typeof v === 'boolean') return { value: v };
            const s = String(v).trim().toLowerCase();
            if (['true', '1', 'có', 'co', 'yes'].includes(s)) return { value: true };
            if (['false', '0', 'không', 'khong', 'no'].includes(s)) return { value: false };
            return { error: 'cần là TRUE hoặc FALSE' };
        }
        case 'date':
            if (v instanceof Date) return { value: v.toISOString().slice(0, 10) };
            return typeof v === 'string' ? { value: v.trim() } : { error: 'cần là ngày (YYYY-MM-DD)' };
    }
}

//3. Đọc sheet đầu tiên thành các dòng
export async function readSheet(buffer: Buffer, cols: Col[], maxRows: number): Promise<RawRow[]> {
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    } catch {
        throw new BadRequestException('Không đọc được file xlsx (file hỏng hoặc sai định dạng)');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('File không có sheet nào');
    if (ws.rowCount > HARD_ROW_LIMIT) {
        throw new BadRequestException(`File vượt quá ${HARD_ROW_LIMIT} dòng`);
    }

    // Dòng 1: tiêu đề. Mỗi cột phải đúng tên, không lặp, không có cột lạ
    const known = new Map(cols.map((c) => [c.key.toLowerCase(), c.key]));
    const colIndex = new Map<string, number>(); // key -> số cột trong sheet
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, n) => {
        const name = cell.text.trim().toLowerCase();
        if (!name) return;
        const key = known.get(name);
        if (!key) throw new BadRequestException(`Cột không hợp lệ: ${name}. Hãy dùng đúng file mẫu.`);
        if (colIndex.has(key)) throw new BadRequestException(`Cột bị lặp: ${key}`);
        colIndex.set(key, n);
    });
    const missing = cols.filter((c) => c.required && !colIndex.has(c.key)).map((c) => c.key);
    if (missing.length > 0) {
        throw new BadRequestException(`Thiếu cột bắt buộc: ${missing.join(', ')}`);
    }

    const out: RawRow[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const values: Record<string, unknown> = {};
        const errors: string[] = [];
        let empty = true;

        for (const col of cols) {
            const n = colIndex.get(col.key);
            if (!n) continue;
            let v: Plain;
            try {
                v = plain(row.getCell(n).value);
            } catch (e) {
                errors.push(`${col.key}: ${(e as Error).message}`);
                empty = false;
                continue;
            }
            if (v === null || (typeof v === 'string' && v.trim() === '')) continue; // ô trống
            empty = false;
            const c = coerce(v, col);
            if (c.error) errors.push(`${col.key}: ${c.error}`);
            else values[col.key] = c.value;
        }

        if (empty) continue; // bỏ qua dòng trống hoàn toàn
        if (out.length >= maxRows) {
            throw new BadRequestException(`File vượt quá ${maxRows} dòng dữ liệu`);
        }
        out.push({ row: r, values, errors });
    }
    if (out.length === 0) throw new BadRequestException('File không có dòng dữ liệu nào');
    return out;
}