import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DemoStore } from './store/DemoStore';
import { SolanaService } from './services/SolanaService';
import { CommerceService } from './services/CommerceService';
import { TreasuryGuardService } from './services/TreasuryGuardService';
import { WorkspaceService } from './services/WorkspaceService';
import type {
  ApiResponse,
  ApprovalInput,
  BootstrapRequest,
  ClaimPaymentLinkInput,
  CounterpartyInput,
  CreateClaimLinkInput,
  CreateInvoiceInput,
  CreatePaymentLinkInput,
  PayoutSubmissionInput,
  TreasuryPolicy,
  VerifyPaymentLinkInput,
  WorkspaceAccessInput,
  WorkspaceConnectInput,
  WorkspaceFundingInput,
} from './types/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../..');
const clientDist = path.resolve(appRoot, 'dist/client');
const dataFile = path.resolve(appRoot, '.data/stablehacks-state.json');
const port = Number(process.env.PORT || 4179);
const host = process.env.HOST || '127.0.0.1';

const solana = new SolanaService(process.env.SOLANA_RPC_URL);
const store = new DemoStore(dataFile, solana.getRpcUrl(), solana.getExplorerBaseUrl());
const treasuryGuard = new TreasuryGuardService(store, solana);
const workspaceService = new WorkspaceService(solana, treasuryGuard);
const commerceService = new CommerceService(solana, treasuryGuard);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function sendResponse<T>(res: express.Response, payload: ApiResponse<T>, status = 200) {
  res.status(status).json(payload);
}

function success<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

function failure(message: string): ApiResponse {
  return {
    success: false,
    error: message,
    timestamp: Date.now(),
  };
}

function route(
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): express.RequestHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error.';
      sendResponse(res, failure(message), 400);
    }
  };
}

app.get('/api/state', route(async (_req, res) => {
  sendResponse(res, success(await treasuryGuard.getDashboardState()));
}));

app.post('/api/workspace/connect', route(async (req, res) => {
  const body = (req.body || {}) as WorkspaceConnectInput;
  sendResponse(res, success(await workspaceService.connectWallet(body)));
}));

app.get('/api/workspace/:profileId', route(async (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  sendResponse(res, success(await workspaceService.getWorkspaceState(req.params.profileId, sessionId)));
}));

app.post('/api/workspace/:profileId/refresh-assets', route(async (req, res) => {
  const body = (req.body || {}) as WorkspaceAccessInput;
  sendResponse(
    res,
    success(await workspaceService.refreshAssets(req.params.profileId, body.sessionId)),
  );
}));

app.post('/api/workspace/:profileId/airdrop', route(async (req, res) => {
  const body = (req.body || {}) as WorkspaceFundingInput;
  sendResponse(
    res,
    success(
      await workspaceService.requestWalletAirdrop(
        req.params.profileId,
        body.sessionId,
        typeof body.amount === 'number' ? body.amount : 1,
      ),
    ),
  );
}));

app.post('/api/workspace/:profileId/seed-stablecoin', route(async (req, res) => {
  const body = (req.body || {}) as WorkspaceFundingInput;
  sendResponse(
    res,
    success(
      await workspaceService.seedStablecoin(
        req.params.profileId,
        body.sessionId,
        typeof body.amount === 'number' ? body.amount : 250,
      ),
    ),
  );
}));

app.post('/api/workspace/:profileId/payment-links', route(async (req, res) => {
  const body = (req.body || {}) as CreatePaymentLinkInput;
  await commerceService.createPaymentLink(req.params.profileId, body);
  sendResponse(res, success(await workspaceService.getWorkspaceState(req.params.profileId, body.sessionId)));
}));

app.post('/api/workspace/:profileId/claim-links', route(async (req, res) => {
  const body = (req.body || {}) as CreateClaimLinkInput;
  await commerceService.createClaimLink(req.params.profileId, body);
  sendResponse(res, success(await workspaceService.getWorkspaceState(req.params.profileId, body.sessionId)));
}));

app.post('/api/workspace/:profileId/invoices', route(async (req, res) => {
  const body = (req.body || {}) as CreateInvoiceInput;
  await commerceService.createInvoice(req.params.profileId, body);
  sendResponse(res, success(await workspaceService.getWorkspaceState(req.params.profileId, body.sessionId)));
}));

app.get('/api/public/links/:slug', route(async (req, res) => {
  sendResponse(
    res,
    success(await commerceService.getPublicLinkState(req.params.slug, `${req.protocol}://${req.get('host')}`)),
  );
}));

app.post('/api/public/links/:slug/pay', route(async (req, res) => {
  const body = (req.body || {}) as VerifyPaymentLinkInput;
  sendResponse(
    res,
    success(await commerceService.verifyPaymentLink(req.params.slug, body.txSignature, `${req.protocol}://${req.get('host')}`)),
  );
}));

app.post('/api/public/links/:slug/claim', route(async (req, res) => {
  const body = (req.body || {}) as ClaimPaymentLinkInput;
  sendResponse(
    res,
    success(await commerceService.claimPayoutLink(req.params.slug, body.recipientAddress, `${req.protocol}://${req.get('host')}`)),
  );
}));

app.post('/api/bootstrap', route(async (req, res) => {
  const body = (req.body || {}) as BootstrapRequest;
  sendResponse(res, success(await treasuryGuard.bootstrap(body)));
}));

app.post('/api/policy', route(async (req, res) => {
  const body = (req.body || {}) as Partial<TreasuryPolicy>;
  sendResponse(res, success(await treasuryGuard.updatePolicy(body)));
}));

app.post('/api/counterparties', route(async (req, res) => {
  const body = (req.body || {}) as CounterpartyInput;
  sendResponse(res, success(await treasuryGuard.createCounterparty(body)));
}));

app.post('/api/payouts', route(async (req, res) => {
  const body = (req.body || {}) as PayoutSubmissionInput;
  sendResponse(res, success(await treasuryGuard.submitPayout(body)));
}));

app.post('/api/payouts/:id/approve', route(async (req, res) => {
  const body = (req.body || {}) as ApprovalInput;
  sendResponse(res, success(await treasuryGuard.approvePayout(req.params.id, body)));
}));

app.post('/api/payouts/:id/reject', route(async (req, res) => {
  const body = (req.body || {}) as ApprovalInput;
  sendResponse(res, success(await treasuryGuard.rejectPayout(req.params.id, body)));
}));

app.post('/api/validate-resources', route(async (_req, res) => {
  sendResponse(res, success(await treasuryGuard.refreshValidations()));
}));

app.get('/api/export', route(async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const payload = await treasuryGuard.exportAudit(format);
  res.setHeader('content-type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json');
  res.setHeader('content-disposition', `attachment; filename="${payload.filename}"`);
  res.status(200).send(payload.content);
}));

app.get('/api/health', route(async (_req, res) => {
  sendResponse(
    res,
    success({
      ok: true,
      rpcUrl: solana.getRpcUrl(),
      slot: await solana.getCurrentSlot(),
      agentObservedSlot: await solana.getAgentObservedSlot(),
      timestamp: Date.now(),
    }),
  );
}));

app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(clientDist, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Veridex Treasury Guard listening on http://${host}:${port}`);
  console.log(`Using Solana RPC: ${solana.getRpcUrl()}`);
});
