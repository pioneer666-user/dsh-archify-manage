# 提交复核流程 · 节点详情（设计版）

> 虚构业务（Campus Event Registration）的示例素材；本版为设计阶段文案，尚无源码证据。

## submit_registration
【设计】学生在门户填写报名表并提交；表单只收集必要字段。

## check_eligibility
【设计】校验账户状态与重复报名，判定是否受理。

## create_record
【设计】一次事务内落座位或候补记录，失败整体回滚。

## send_confirmation
【设计】发送确认消息，含座位与候补两种文案。

## reject_registration
【设计】拒绝时把原因回给学生。

## waitlist_entry
【设计】名额满时写入候补，不占座位。
