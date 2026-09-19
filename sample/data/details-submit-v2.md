# 提交复核流程 · 节点详情（实现版）

> 虚构业务（Campus Event Registration）的示例素材；本版为补证据后的实现文案。

## submit_registration
【设计】学生在门户填写报名表并提交；表单只收集必要字段。

## check_eligibility
【实现】按 src/activity-eligibility.js 的 checkEligibility 落地：未验证账户与重复报名都会被拒（证据 eligibility-core）。

## create_record
【设计】一次事务内落座位或候补记录，失败整体回滚。

## send_confirmation
【设计】发送确认消息，含座位与候补两种文案。

## reject_registration
【设计】拒绝时把原因回给学生。

## waitlist_entry
【实现】候补记录与确认消息已按 waitlist-notify 边接通。
