import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

const FOLDER = 'programmize/avatars';

@Injectable()
export class CloudinaryService {
    // Chưa cấu hình thì báo 503 gọn gàng, không làm sập cả ứng dụng
    private ensure() {
        const cfg = cloudinary.config({ secure: true });
        if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
            throw new ServiceUnavailableException('Chưa cấu hình lưu trữ ảnh');
        }
    }

    uploadAvatar(buffer: Buffer, userId: number): Promise<string> {
        this.ensure();
        return new Promise((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    {
                        folder: FOLDER,
                        public_id: `user-${userId}`, // mỗi người một ảnh, tải lại sẽ ghi đè
                        overwrite: true,
                        invalidate: true,
                        resource_type: 'image',
                        allowed_formats: ['jpg', 'png', 'webp'],
                        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
                    },
                    (error, result) => {
                        if (error || !result) return reject(error ?? new Error('Cloudinary không trả kết quả'));
                        resolve(result.secure_url);
                    },
                )
                .end(buffer);
        });
    }

    async deleteAvatar(userId: number) {
        this.ensure();
        await cloudinary.uploader.destroy(`${FOLDER}/user-${userId}`, { invalidate: true });
    }
}