import { Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthUser } from "../common/types/auth-user.js";
import { PaymentsService } from "./payments.service.js";

@Controller('payments')
@Roles('STUDENT', 'INSTRUCTOR', 'ADMIN')
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) { }
    // Frontend gọi lặp 3-5 giây/lần để biết đã thanh toán chưa
    @Get(':txnRef/status')
    status(@CurrentUser() user: AuthUser, @Param('txnRef') txnRef: string) {
        return this.payments.getStatus(user.id, txnRef);
    }
    //DEV:gia lap chuyen khoan
    @Post('dev/:txnRef/confirm')
    devConfirm(@CurrentUser() user:AuthUser,@Param('txnRef') txnRef:string){
        return this.payments.devConfirm(user.id,txnRef);
    }
}