-- AlterTable
ALTER TABLE `payment` MODIFY `method` ENUM('FREE', 'QR', 'VNPAY') NOT NULL;
