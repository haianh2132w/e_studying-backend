import { BadRequestException } from '@nestjs/common';

export interface AllowedType {
    mimes: string[];
    contentType: string;
    hasMagic: (b: Buffer) => boolean;
}

const isZip = (b: Buffer) =>
    b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const DOC_TYPES: Record<string, AllowedType> = {
    pdf: {
        mimes: ['application/pdf'],
        contentType: 'application/pdf',
        hasMagic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
    },
    docx: { mimes: [DOCX], contentType: DOCX, hasMagic: isZip },
    pptx: { mimes: [PPTX], contentType: PPTX, hasMagic: isZip },
};

// Dùng ở Pha 9 cho ảnh đại diện và ảnh bìa
export const IMAGE_TYPES: Record<string, AllowedType> = {
    jpg: {
        mimes: ['image/jpeg'],
        contentType: 'image/jpeg',
        hasMagic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    png: {
        mimes: ['image/png'],
        contentType: 'image/png',
        hasMagic: (b) =>
            b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    webp: {
        mimes: ['image/webp'],
        contentType: 'image/webp',
        hasMagic: (b) =>
            b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
    },
};

// Trả về đuôi file chuẩn hóa nếu hợp lệ, ngược lại ném 400
export function validateUpload(
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    allowed: Record<string, AllowedType>,
): string {
    if (file.size === 0) throw new BadRequestException('File rỗng');

    const dot = file.originalname.lastIndexOf('.');
    let ext = dot >= 0 ? file.originalname.slice(dot + 1).toLowerCase() : '';
    if (ext === 'jpeg') ext = 'jpg';

    const type = allowed[ext];
    if (!type) {
        throw new BadRequestException(`Định dạng không được hỗ trợ. Cho phép: ${Object.keys(allowed).join(', ')}`);
    }
    if (!type.mimes.includes(file.mimetype)) {
        throw new BadRequestException('Loại file (mime) không khớp với đuôi file');
    }
    if (!type.hasMagic(file.buffer)) {
        throw new BadRequestException('Nội dung file không đúng định dạng khai báo');
    }
    return ext;
}

// Làm sạch tên file hiển thị: bỏ ký tự đường dẫn, ký tự điều khiển, ký tự HTML
export function cleanFileName(original: string, ext: string): string {
    // multer đọc tên file theo latin1, đổi lại sang UTF-8 để giữ được tiếng Việt
    const decoded = Buffer.from(original, 'latin1').toString('utf8');
    const base = decoded
        .replace(/\.[^.]*$/, '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 150);
    return `${base || 'tai-lieu'}.${ext}`;
}