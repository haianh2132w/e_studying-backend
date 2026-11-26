import { BadRequestException } from '@nestjs/common';

interface ImageType {
    mime: string;
    magic: (b: Buffer) => boolean;
}

// Dùng Map để đuôi như "constructor" không khớp nhầm thuộc tính có sẵn của object
const TYPES = new Map<string, ImageType>([
    ['jpg', { mime: 'image/jpeg', magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
    [
        'png',
        {
            mime: 'image/png',
            magic: (b) =>
                b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        },
    ],
    [
        'webp',
        {
            mime: 'image/webp',
            magic: (b) =>
                b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
        },
    ],
]);

export function validateImage(
    file?: { originalname: string; mimetype: string; buffer: Buffer; size: number },
) {
    if (!file) throw new BadRequestException('Thiếu file (tên trường phải là file)');
    if (file.size === 0) throw new BadRequestException('File rỗng');

    const dot = file.originalname.lastIndexOf('.');
    let ext = dot >= 0 ? file.originalname.slice(dot + 1).toLowerCase() : '';
    if (ext === 'jpeg') ext = 'jpg';

    const type = TYPES.get(ext);
    if (!type) throw new BadRequestException('Chỉ nhận ảnh JPG, PNG hoặc WebP');
    if (file.mimetype !== type.mime) throw new BadRequestException('Loại file (mime) không khớp với đuôi file');
    if (!type.magic(file.buffer)) throw new BadRequestException('Nội dung file không phải ảnh hợp lệ');
}