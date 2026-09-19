// 虚构业务：活动报名资格校验（实验素材，非真实代码）
export function accountLabel(account) {
  return account.verified ? 'verified' : 'unverified';
}

export function checkEligibility(account, existing) {
  if (!account.verified) return { ok: false, reason: 'account-unverified' };
  if (existing.some((row) => row.account === account.id)) return { ok: false, reason: 'duplicate-entry' };
  return { ok: true, reason: 'eligible' };
}

export function nextStep(result) {
  return result.ok ? 'create_record' : 'reject_registration';
}
