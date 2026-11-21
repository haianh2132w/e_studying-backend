import sanitizeHtml from 'sanitize-html';

// Chỉ cho phép một danh sách thẻ và thuộc tính "an toàn", mọi thứ khác bị loại
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'], // chặn javascript:, data:
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}

// Lấy phần chữ thuần, dùng để kiểm tra nội dung có rỗng không
export function toPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}