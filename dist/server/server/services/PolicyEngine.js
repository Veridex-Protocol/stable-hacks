function todayStart() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}
function makeReason(code, description, severity) {
    return { code, description, severity };
}
export class PolicyEngine {
    solana;
    constructor(solana) {
        this.solana = solana;
    }
    async evaluate(params) {
        const { policy, counterparty, payouts, input, assetMintAddress } = params;
        const telemetry = await this.solana.analyzeAddress(counterparty.walletAddress);
        const reasons = [];
        const todayPayoutVolume = payouts
            .filter((entry) => entry.createdAt >= todayStart())
            .filter((entry) => !['blocked', 'rejected', 'failed'].includes(entry.status))
            .reduce((total, entry) => total + entry.amount, 0);
        const checks = {
            kycValid: counterparty.kycStatus === 'verified' && !counterparty.sanctioned,
            kytClean: telemetry.riskScore < 65,
            sanctionsClean: !counterparty.sanctioned,
            corridorAllowed: policy.allowedCorridors.includes(input.corridor) &&
                counterparty.approvedCorridors.includes(input.corridor),
            amountWithinLimit: input.amount <= policy.maxTransactionAmount,
            dailyLimitOk: todayPayoutVolume + input.amount <= policy.dailySendLimit,
            travelRuleCompliant: !policy.requireTravelRule ||
                input.amount < policy.travelRuleThreshold ||
                Boolean(input.travelRuleMetadata),
            assetAllowed: policy.allowedAssets.includes(assetMintAddress),
        };
        if (!checks.assetAllowed) {
            reasons.push(makeReason('ASSET_NOT_ALLOWED', 'The selected SPL stablecoin mint is not approved by the treasury policy.', 'error'));
        }
        if (!checks.kycValid) {
            reasons.push(makeReason('KYC_REQUIRED', 'Counterparty KYC is not in a verified state, so settlement must fail closed.', 'error'));
        }
        if (!checks.sanctionsClean) {
            reasons.push(makeReason('SANCTIONS_BLOCK', 'The counterparty is marked as sanctioned and cannot receive treasury funds.', 'error'));
        }
        if (!checks.corridorAllowed) {
            reasons.push(makeReason('CORRIDOR_NOT_ALLOWED', 'The requested payout corridor is not approved for this policy and counterparty.', 'error'));
        }
        if (!checks.amountWithinLimit) {
            reasons.push(makeReason('MAX_TX_LIMIT', `Requested amount exceeds the single-transfer ceiling of ${policy.maxTransactionAmount}.`, 'error'));
        }
        if (!checks.dailyLimitOk) {
            reasons.push(makeReason('DAILY_LIMIT_EXCEEDED', `Approving this payout would exceed the daily treasury limit of ${policy.dailySendLimit}.`, 'error'));
        }
        if (!checks.travelRuleCompliant) {
            reasons.push(makeReason('TRAVEL_RULE_MISSING', 'Travel Rule metadata is required for this amount threshold before settlement can proceed.', 'error'));
        }
        if (telemetry.riskLevel === 'critical') {
            reasons.push(makeReason('KYT_CRITICAL', 'Live Solana telemetry flagged the recipient as critical risk based on address history.', 'error'));
        }
        else if (telemetry.riskLevel === 'high') {
            reasons.push(makeReason('KYT_HIGH', 'Live Solana telemetry flagged elevated recipient risk, so manual approval is required.', 'warning'));
        }
        else if (telemetry.riskLevel === 'medium') {
            reasons.push(makeReason('KYT_MEDIUM', 'Recipient telemetry is thin enough that a finance approver should review it.', 'warning'));
        }
        else {
            reasons.push(makeReason('KYT_OK', `Live Solana telemetry returned a ${telemetry.riskLevel}-risk profile for the recipient.`, 'info'));
        }
        if (input.amount >= policy.escalationThreshold) {
            reasons.push(makeReason('VALUE_ESCALATION', `Amount is at or above the escalation threshold of ${policy.escalationThreshold}.`, 'warning'));
        }
        const hasBlockingIssue = reasons.some((reason) => reason.severity === 'error');
        const hasEscalationSignal = reasons.some((reason) => reason.severity === 'warning') || input.amount >= policy.escalationThreshold;
        return {
            passed: !hasBlockingIssue,
            verdict: hasBlockingIssue ? 'blocked' : hasEscalationSignal ? 'escalated' : 'approved',
            reasons,
            telemetry,
            checks,
        };
    }
}
