#!/usr/bin/env node
/**
 * Writes docs/deployments.md from the live Zenex mainnet deployment.
 *
 * Each value has one source:
 * - record.mainnet.json, reviewed and committed: the network, the factory, the
 *   wallet factory, and the code each contract must run. Nothing on chain
 *   points to those, so a person records them.
 * - configUrl, the public config the Zenex app loads: the markets, the market
 *   router, the fee forwarder, and the smart-wallet contracts the app uses.
 * - The chain, through STELLAR_RPC_URL: every parameter, owner, status, and
 *   code hash, and the oracle, treasury, vault, and token each market reports.
 * - zenex-contracts at the recorded commit (ZENEX_CONTRACTS_DIR, default
 *   ../zenex-contracts): the protocol limits and the release builds that the
 *   code hashes must match.
 *
 * Every cross-check failure stops the run, so the page is never written from
 * values that disagree with each other.
 *
 * Usage: STELLAR_RPC_URL=<mainnet rpc> npm run deployments
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'docs/deployments.md');
const record = JSON.parse(readFileSync(path.join(HERE, 'record.mainnet.json'), 'utf8'));

const RPC_URL = process.env.STELLAR_RPC_URL;
const CONTRACTS_DIR = process.env.ZENEX_CONTRACTS_DIR ?? path.resolve(ROOT, '../zenex-contracts');
// The all-zero account. A read-only simulation needs a source but never loads it.
const READER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32));

function fail(message) {
  console.error(`deployments: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

if (!RPC_URL) fail('set STELLAR_RPC_URL to a Stellar mainnet RPC endpoint');
const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });

// ---------------------------------------------------------------- chain reads

async function view(contractId, method, ...args) {
  const tx = new TransactionBuilder(new Account(READER, '0'), {
    fee: BASE_FEE,
    networkPassphrase: record.network.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(0)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) fail(`${method} on ${contractId} failed: ${sim.error}`);
  return scValToNative(sim.result.retval);
}

async function tryView(contractId, method) {
  try {
    const tx = new TransactionBuilder(new Account(READER, '0'), {
      fee: BASE_FEE,
      networkPassphrase: record.network.passphrase,
    })
      .addOperation(new Contract(contractId).call(method))
      .setTimeout(0)
      .build();
    const sim = await server.simulateTransaction(tx);
    return rpc.Api.isSimulationError(sim) ? undefined : scValToNative(sim.result.retval);
  } catch {
    return undefined;
  }
}

/** The hash of the code the chain holds for a contract, or null for a Stellar asset contract. */
async function codeHash(contractId) {
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );
  const { entries } = await server.getLedgerEntries(key);
  check(entries.length === 1, `no contract instance at ${contractId}`);
  const executable = entries[0].val.contractData().val().instance().executable();
  if (executable.switch().name !== 'contractExecutableWasm') return null;
  return executable.wasmHash().toString('hex');
}

async function latestLedger() {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
  });
  const { result } = await response.json();
  check(result?.sequence, 'getLatestLedger returned no ledger');
  return { sequence: result.sequence, closeTime: Number(result.closeTime ?? Math.floor(Date.now() / 1000)) };
}

// ------------------------------------------------------------- source reads

function gitShow(file) {
  try {
    return execFileSync('git', ['-C', CONTRACTS_DIR, 'show', `${record.core.commit}:${file}`], {
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return fail(`cannot read ${file} at ${record.core.commit} in ${CONTRACTS_DIR}`);
  }
}

/** Evaluates the integer constants of a Rust source file, in declaration order. */
function constants(file, scope = {}) {
  const source = gitShow(file).toString('utf8');
  for (const [, name, expr] of source.matchAll(/pub const ([A-Z0-9_]+): (?:i128|u64|u32) = ([^;]+);/g)) {
    scope[name] = evaluate(expr, scope);
  }
  return scope;
}

function evaluate(expr, scope) {
  const tokens = expr.match(/\d[\d_]*|[A-Z_][A-Z0-9_]*|[-+*/()]/g) ?? [];
  check(tokens.join('') === expr.replace(/\s+/g, ''), `cannot parse constant expression ${expr}`);
  let at = 0;
  const primary = () => {
    const token = tokens[at++];
    if (token === '(') {
      const value = sum();
      check(tokens[at++] === ')', `unbalanced ${expr}`);
      return value;
    }
    if (/^\d/.test(token)) return BigInt(token.replaceAll('_', ''));
    check(token in scope, `unknown constant ${token} in ${expr}`);
    return scope[token];
  };
  const product = () => {
    let value = primary();
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++];
      const right = primary();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++];
      const right = product();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  check(at === tokens.length, `cannot evaluate ${expr}`);
  return value;
}

/**
 * The limit column below restates these validation rules in words. A rule
 * that no longer appears verbatim at the recorded commit stops the run, so the
 * words are reviewed whenever the contracts change.
 */
const RULES = {
  'market/src/engine/config.rs': [
    'self.keeper_rate > MAX_KEEPER_RATE',
    'self.fee_dom > MAX_FEE_RATE',
    'self.fee_non_dom > MAX_FEE_RATE',
    'self.max_util_open > MAX_UTIL',
    'self.max_util_withdraw > MAX_UTIL',
    'self.init_margin > MAX_MARGIN',
    'self.liq_fee > MAX_LIQ_FEE',
    'self.notional_lock > MAX_NOTIONAL_LOCK',
    'self.redeem_lock > MAX_REDEEM_LOCK',
    'self.init_margin < MIN_MARGIN',
    'self.notional_lock < MIN_NOTIONAL_LOCK',
    'self.max_position_notional <= self.min_position_notional',
    'self.max_open_interest < self.max_position_notional',
    'self.min_order_notional > self.min_position_notional',
    'self.exec_fee > self.min_order_margin',
    'self.deposit_fee > MAX_FEE_RATE || self.redeem_fee > MAX_FEE_RATE',
    'self.max_util_open <= 0 || self.max_util_withdraw < self.max_util_open',
    'self.fee_dom < self.fee_non_dom',
    'self.target_util >= SCALAR_18',
    'self.increased_borrow_rate < self.borrow_rate',
    'self.increased_borrow_rate > MAX_BORROW_RATE',
    'self.threshold_stable_funding > SCALAR_18',
    'self.threshold_decrease_funding > self.threshold_stable_funding',
    'self.funding_min > self.funding_max',
    'self.funding_max > MAX_FUNDING_RATE',
    'self.funding_increase > MAX_FUNDING_RATE',
    'self.funding_decrease > MAX_FUNDING_RATE',
    'self.adl_max_pnl >= SCALAR_18',
    'self.adl_max_pnl < MIN_ADL_TRIGGER',
    'self.adl_clear_target > self.adl_max_pnl',
    'self.adl_clear_target < MIN_ADL_CLEAR',
    'self.max_pnl_trader >= SCALAR_18',
    'self.adl_max_pnl > self.max_pnl_trader',
    'self.max_pnl_withdraw <= 0',
    'self.max_pnl_withdraw > self.adl_clear_target',
    'self.max_vault_balance <= 0',
    'self.min_deposit.checked_mul(MIN_DEPOSIT_DIVISOR)',
    'self.maintenance_margin <= self.liq_fee || self.init_margin <= self.maintenance_margin',
    'self.init_margin <= self.maintenance_margin + self.fee_non_dom + MIN_CHUNK_IMPACT_CAP',
    '.checked_mul(SCALAR_18 / MIN_CHUNK_IMPACT_CAP)',
  ],
  'market/src/engine/math.rs': ['fee.min(apply_factor_ceil(e, notional, MAX_IMPACT_RATE))'],
  'oracle/src/lib.rs': [
    'trade_staleness < MIN_STALENESS_SECONDS',
    'trade_staleness > MAX_TRADE_STALENESS_SECONDS',
    'close_staleness < trade_staleness',
    'close_staleness > MAX_CLOSE_STALENESS_SECONDS',
    'spread_reduction_factor < 0 || spread_reduction_factor > SCALAR_18',
  ],
  'treasury/src/lib.rs': ['!(0..=SCALAR_18 / 2).contains(&rate)'],
};

function checkRules() {
  for (const [file, fragments] of Object.entries(RULES)) {
    const source = gitShow(file).toString('utf8').replace(/\s+/g, ' ');
    for (const fragment of fragments) {
      check(
        source.includes(fragment),
        `the rule "${fragment}" is gone from ${file} at ${record.core.commit}. Review the limit words in generate.mjs.`,
      );
    }
  }
}

// ------------------------------------------------------------------ format

const SCALAR = 10n ** 18n;
const YEAR = 31_536_000n;

/** num / den as a decimal string, rounded half up to `places`, trailing zeros dropped. */
function decimal(num, den, places) {
  const scale = 10n ** BigInt(places);
  const scaled = (num * scale * 2n + den) / (2n * den);
  const whole = (scaled / scale).toLocaleString('en-US');
  const fraction = (scaled % scale).toString().padStart(places, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

const exact = (num, den, places) => (num * 10n ** BigInt(places)) % den === 0n;

/** A value that is not a round number, to two significant figures. */
function about(num, den) {
  const value = Number(num) / Number(den);
  return `about ${Number(value.toPrecision(2)).toLocaleString('en-US')}`;
}

/** A SCALAR_18 fraction as a percentage. */
function pct(fraction) {
  const num = fraction * 100n;
  return exact(num, SCALAR, 4) ? `${decimal(num, SCALAR, 4)}%` : `${about(num, SCALAR)}%`;
}

/** A SCALAR_18 per-second rate as a percentage a year. */
function perYear(rate) {
  const num = rate * YEAR * 100n;
  return exact(num, SCALAR, 2) ? `${decimal(num, SCALAR, 2)}% a year` : `${about(num, SCALAR)}% a year`;
}

const plural = (n, unit) => `${n.toLocaleString('en-US')} ${unit}${n === 1 ? '' : 's'}`;

/** A whole number of seconds in the largest unit that divides it. */
function duration(seconds) {
  const s = Number(seconds);
  if (s === 0) return '0 seconds';
  if (s % 86_400 === 0) return plural(s / 86_400, 'day');
  if (s % 3_600 === 0) return plural(s / 3_600, 'hour');
  if (s % 60 === 0) return plural(s / 60, 'minute');
  return plural(s, 'second');
}

/** num / den seconds, rounded to the nearest whole unit. */
function aboutDuration(num, den) {
  const s = Number(num) / Number(den);
  if (s >= 1.5 * 86_400) return `about ${plural(Math.round(s / 86_400), 'day')}`;
  if (s >= 1.5 * 3_600) return `about ${plural(Math.round(s / 3_600), 'hour')}`;
  if (s >= 90) return `about ${plural(Math.round(s / 60), 'minute')}`;
  return `about ${plural(Math.round(s), 'second')}`;
}

const STATUS = ['Active', 'On ice', 'Frozen', 'Delisted', 'Retired'];

const explorer = (kind, id) => `${record.network.explorer}/${kind}/${id}`;
const contractLink = (id) => `[\`${id}\`](${explorer('contract', id)})`;
const accountLink = (id) => `[\`${id}\`](${explorer('account', id)})`;
const addressLink = (id) => (id.startsWith('C') ? contractLink(id) : accountLink(id));
const hex = (bytes) => Buffer.from(bytes).toString('hex');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function list(items) {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function table(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

// -------------------------------------------------------------------- read

async function main() {
  checkRules();
  const market = constants('market/src/engine/constants.rs');
  const oracleLimits = constants('oracle/src/constants.rs');

  const network = await server.getNetwork();
  check(network.passphrase === record.network.passphrase, `the RPC serves ${network.passphrase}, not ${record.network.name}`);
  const ledger = await latestLedger();

  const config = await (await fetch(record.configUrl)).json();
  check(Array.isArray(config.markets) && config.markets.length > 0, `${record.configUrl} lists no market`);

  const factory = record.core.factory;
  const releaseHash = Object.fromEntries(
    Object.entries(record.core.releaseBuilds).map(([name, file]) => [name, sha256(gitShow(file))]),
  );

  const markets = [];
  for (const entry of config.markets) {
    const id = entry.trading;
    const [token, vault, oracle, treasury, feed, status, cfg, owner] = await Promise.all([
      view(id, 'get_token'),
      view(id, 'get_vault'),
      view(id, 'get_oracle'),
      view(id, 'get_treasury'),
      view(id, 'get_feed'),
      view(id, 'get_status'),
      view(id, 'get_config'),
      view(id, 'get_owner'),
    ]);
    const label = entry.id.toUpperCase();
    check(token === entry.collateral, `${label}: the market settles in ${token}, the app config says ${entry.collateral}`);
    check(vault === entry.vault, `${label}: the market reports vault ${vault}, the app config says ${entry.vault}`);
    check(hex(feed) === entry.feedId.replace(/^0x/, ''), `${label}: the market reports feed ${hex(feed)}, the app config says ${entry.feedId}`);
    check((await view(vault, 'get_strategy')) === id, `${label}: the vault does not answer to the market`);
    check((await view(vault, 'query_asset')) === token, `${label}: the vault holds a different asset`);
    check(
      (await view(factory, 'is_deployed', nativeToScVal(id, { type: 'address' }))) === true,
      `${label}: the factory ${factory} did not deploy the market ${id}`,
    );
    check((await codeHash(id)) === releaseHash.market, `${label}: the market code is not the release build`);
    check((await codeHash(vault)) === releaseHash.vault, `${label}: the vault code is not the release build`);
    const [vaultName, vaultSymbol, vaultDecimals] = await Promise.all([
      view(vault, 'name'),
      view(vault, 'symbol'),
      view(vault, 'decimals'),
    ]);
    check(
      vaultDecimals === entry.collateralDecimals + entry.vaultDecimalsOffset,
      `${label}: the vault shares carry ${vaultDecimals} decimals, the app config implies ${entry.collateralDecimals + entry.vaultDecimalsOffset}`,
    );
    const retirement = Number(status) >= 3 ? await view(id, 'get_retirement') : null;
    markets.push({ id, label, token, vault, oracle, treasury, feed: hex(feed), status: Number(status), cfg, owner, vaultName, vaultSymbol, retirement });
  }

  const unique = (key) => [...new Set(markets.map((m) => m[key]))];
  const tokens = unique('token');
  const oracles = unique('oracle');
  const treasuries = unique('treasury');
  check(tokens.length === 1, 'the markets settle in more than one token. Extend the generator first.');
  check(oracles.length === 1 && treasuries.length === 1, 'the markets use more than one oracle or treasury. Extend the generator first.');
  const [tokenId] = tokens;
  const [oracle] = oracles;
  const [treasury] = treasuries;

  const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
    view(tokenId, 'name'),
    view(tokenId, 'symbol'),
    view(tokenId, 'decimals'),
  ]);
  check(tokenDecimals === config.markets[0].collateralDecimals, `the token carries ${tokenDecimals} decimals, the app config says ${config.markets[0].collateralDecimals}`);
  const issuer = String(tokenName).split(':')[1];

  const [verifier, tradeStaleness, closeStaleness, spreadFactor, oracleOwner] = await Promise.all([
    view(oracle, 'verifier'),
    view(oracle, 'trade_staleness'),
    view(oracle, 'close_staleness'),
    view(oracle, 'spread_reduction_factor'),
    view(oracle, 'get_owner'),
  ]);
  const [treasuryRate, treasuryOwner] = await Promise.all([view(treasury, 'get_rate'), view(treasury, 'get_owner')]);
  const [initMeta, factoryOwner] = await Promise.all([view(factory, 'get_init_meta'), view(factory, 'get_owner')]);

  check((await codeHash(oracle)) === releaseHash.oracle, 'the oracle code is not the release build');
  check((await codeHash(treasury)) === releaseHash.treasury, 'the treasury code is not the release build');
  check((await codeHash(factory)) === releaseHash.factory, 'the factory code is not the release build');

  const app = [
    { name: 'Market router', id: config.contracts.router, does: 'Lets the app create an order and fill it in one transaction, or bundle several calls into one.' },
    {
      name: 'Fee forwarder',
      id: config.feeForwarder.contract,
      does: `Takes the network fee in ${tokenSymbol} when the app sends a transaction for you.`,
    },
    { name: 'Wallet factory', id: record.util.walletFactory, does: 'Creates the smart wallet the app sets up for you.' },
    {
      name: 'Session policy',
      id: config.smartAccount.session,
      does: 'Holds the limits of one-click trading: the contracts a session key may call and the spending limit you choose.',
    },
  ];
  for (const contract of app) {
    check(contract.id, `the app config has no ${contract.name.toLowerCase()}`);
    const expected = record.util.codeHashes[contract.id];
    check(expected, `record.mainnet.json has no code hash for the ${contract.name.toLowerCase()} ${contract.id}`);
    check((await codeHash(contract.id)) === expected, `the ${contract.name.toLowerCase()} runs code other than ${record.util.tag}`);
    contract.hash = expected;
  }
  const walletVerifiers = [
    { name: 'Passkey verifier', id: config.smartAccount.verifiers.webauthn, does: 'Checks a passkey signature for a smart wallet. It comes with the smart-account kit the wallets are built on.' },
    { name: 'Ed25519 verifier', id: config.smartAccount.verifiers.ed25519, does: 'Checks a key signature for a smart wallet. It comes with the same kit.' },
  ];
  for (const contract of walletVerifiers) check((await codeHash(contract.id)) !== undefined, `no contract at ${contract.id}`);

  // Owners, grouped, with a timelock named as one.
  const owned = [
    ['the factory', factoryOwner],
    ['the oracle', oracleOwner],
    ['the treasury', treasuryOwner],
    ...markets.map((m) => [`the ${m.label} market`, m.owner]),
  ];
  const owners = new Map();
  for (const [what, who] of owned) owners.set(who, [...(owners.get(who) ?? []), what]);
  const ownerLines = [];
  for (const [who, what] of owners) {
    if (!who) {
      ownerLines.push(`${list(what)[0].toUpperCase()}${list(what).slice(1)} ${what.length === 1 ? 'has' : 'have'} no owner. The owner gave up control, and nobody can change ${what.length === 1 ? 'it' : 'them'}.`);
      continue;
    }
    const delay = who.startsWith('C') ? await tryView(who, 'get_delay') : undefined;
    if (delay !== undefined) {
      ownerLines.push(
        `The timelock ${contractLink(who)} owns ${list(what)}. A change it makes waits ${duration(delay)} in a public queue before anyone can apply it.`,
      );
    } else if (who.startsWith('G')) {
      ownerLines.push(
        `The account ${accountLink(who)} owns ${list(what)}. It is one account and not a timelock, so a change it makes applies at once, with no wait.`,
      );
    } else {
      ownerLines.push(`The contract ${contractLink(who)} owns ${list(what)}.`);
    }
  }

  return { ledger, config, markets, tokenId, tokenSymbol, tokenDecimals, issuer, oracle, verifier, tradeStaleness, closeStaleness, spreadFactor, treasury, treasuryRate, initMeta, factory, releaseHash, app, walletVerifiers, ownerLines, market, oracleLimits };
}

// ------------------------------------------------------------------ render

function render(d) {
  const { market: C, oracleLimits: O } = d;
  const amount = (value) => `${decimal(value, 10n ** BigInt(d.tokenDecimals), d.tokenDecimals)} ${d.tokenSymbol}`;
  const date = new Date(d.ledger.closeTime * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const issuerName = record.knownIssuers[d.issuer];
  const leverage = (margin) => (SCALAR % margin === 0n ? `${(SCALAR / margin).toString()}x` : `${about(SCALAR, margin)}x`);
  const maxYear = (rate) => {
    const value = Number(rate * YEAR * 100n) / Number(SCALAR);
    return Math.abs(value - Math.round(value)) < 1e-6 ? `${Math.round(value).toLocaleString('en-US')}%` : perYear(rate).replace(' a year', '');
  };
  const capital = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

  const parameterRows = (m) => {
    const c = m.cfg;
    const bend = (c.borrow_rate * c.target_util) / SCALAR;
    const borrowing =
      c.increased_borrow_rate === c.borrow_rate
        ? `One straight line from nothing on an unused side to ${perYear(bend)} at the bend and ${perYear(c.increased_borrow_rate)} at full utilization`
        : `A straight line from nothing on an unused side to ${perYear(bend)} at the bend, then a steeper line to ${perYear(c.increased_borrow_rate)} at full utilization`;
    // The impact rate is notional / impact_scalar, two token-dec amounts.
    const impactAtLargest = (c.max_position_notional * SCALAR) / c.impact_scalar;
    const impact =
      impactAtLargest >= C.MAX_IMPACT_RATE
        ? `${pct(C.MAX_IMPACT_RATE)} of the fill at the largest position size of ${amount(c.max_position_notional)}, which is the ceiling`
        : `${pct(impactAtLargest)} of the fill at the largest position size of ${amount(c.max_position_notional)}. The rate doubles when the size doubles.`;
    const buildUp =
      c.funding_increase === 0n
        ? 'The rate never builds'
        : `At full imbalance, from nothing to the cap in ${aboutDuration(c.funding_max, c.funding_increase)}`;
    let windDown =
      c.funding_decrease === 0n
        ? 'The rate never winds down'
        : `From the cap to nothing in ${aboutDuration(c.funding_max, c.funding_decrease)}`;
    if (c.funding_decrease !== 0n && c.threshold_decrease_funding === 0n) {
      windDown += '. No imbalance falls under a 0% level, so this speed never applies on this market.';
    }
    return [
      ['Maximum leverage', `${leverage(c.init_margin)}, from a ${pct(c.init_margin)} initial margin`, `${leverage(C.MAX_MARGIN)} to ${leverage(C.MIN_MARGIN)}, from an initial margin of ${pct(C.MAX_MARGIN)} down to ${pct(C.MIN_MARGIN)}`],
      ['Maintenance margin', `${pct(c.maintenance_margin)} of the position size`, `Above the liquidation fee. The initial margin must exceed it by more than the lower trade fee plus ${pct(C.MIN_CHUNK_IMPACT_CAP)}.`],
      ['Liquidation fee', `${pct(c.liq_fee)} of the size that closes`, `Up to ${pct(C.MAX_LIQ_FEE)}, and below the maintenance margin`],
      ['Position size', `${amount(c.min_position_notional)} to ${amount(c.max_position_notional)}`, 'The smallest above zero and the largest above the smallest. No ceiling.'],
      ['Total size per side', amount(c.max_open_interest), 'At least the largest position size. No ceiling.'],
      ['Minimum per order', `${amount(c.min_order_notional)} of size and ${amount(c.min_order_margin)} of collateral`, 'Both above zero, and the size at most the smallest position size'],
      ['Trade fee', `${pct(c.fee_dom)} on the part of a fill that pushes the sides apart and ${pct(c.fee_non_dom)} on the part that brings them together`, `Each up to ${pct(C.MAX_FEE_RATE)}, and the first never below the second`],
      ['Impact fee', impact, `Never more than ${pct(C.MAX_IMPACT_RATE)} of the fill. A fill of the smallest position size pays at most ${pct(C.MIN_CHUNK_IMPACT_CAP)}.`],
      ['Execution fee', `${amount(c.exec_fee)} per order`, 'At most the minimum collateral per order'],
      ['Keeper share', `${pct(c.keeper_rate)} of the trade fee, the impact fee, the liquidation fee, and the vault fee`, `Up to ${pct(C.MAX_KEEPER_RATE)}`],
      ['Utilization cap', `${pct(c.max_util_open)} of half the vault balance for an increase and ${pct(c.max_util_withdraw)} for a redeem`, `The increase cap above 0% and up to ${pct(C.MAX_UTIL)}. The redeem cap from the increase cap to ${pct(C.MAX_UTIL)}.`],
      ['Borrowing curve bend', `${pct(c.target_util)} utilization`, 'Below 100%'],
      ['Borrowing rate', borrowing, `Up to ${maxYear(C.MAX_BORROW_RATE)} a year at full utilization`],
      ['Funding cap', `${perYear(c.funding_max)} in either direction`, `Up to ${maxYear(C.MAX_FUNDING_RATE)} a year`],
      ['Minimum funding charge', `${perYear(c.funding_min)} whenever a side pays at all`, 'At most the funding cap'],
      ['Funding build-up level', `A ${pct(c.threshold_stable_funding)} imbalance`, 'Up to 100%'],
      ['Funding wind-down level', `A ${pct(c.threshold_decrease_funding)} imbalance`, 'At most the build-up level'],
      ['Funding build-up speed', buildUp, `At most ${maxYear(C.MAX_FUNDING_RATE)} a year added each second`],
      ['Funding wind-down speed', windDown, `At most ${maxYear(C.MAX_FUNDING_RATE)} a year removed each second`],
      ['Auto-deleveraging', `Flags a side at ${pct(c.adl_max_pnl)} of half the vault balance and clears the flag at ${pct(c.adl_clear_target)}`, `The flag from ${pct(C.MIN_ADL_TRIGGER)} to below 100%. The clear level from ${pct(C.MIN_ADL_CLEAR)} up to the flag.`],
      ['Profit cap', `Starts at ${pct(c.max_pnl_trader)} of half the vault balance`, 'From the flag level to below 100%'],
      ['Redeem block', `Refuses a redeem while a side's pending profit sits above ${pct(c.max_pnl_withdraw)} of half the vault balance the redeem would leave`, 'Above 0%, and at most the clear level'],
      ['Vault fee', `${pct(c.deposit_fee)} of the assets a deposit fill moves and ${pct(c.redeem_fee)} of the assets a redeem fill moves`, `Each up to ${pct(C.MAX_FEE_RATE)}`],
      ['Minimum deposit', amount(c.min_deposit), `Above zero, and at most 1/${C.MIN_DEPOSIT_DIVISOR} of the vault balance cap`],
      ['Vault balance cap', amount(c.max_vault_balance), 'Above zero. No ceiling.'],
      ['Redeem cooldown', duration(c.redeem_lock), `Up to ${duration(C.MAX_REDEEM_LOCK)}`],
      ['Lock on new size', duration(c.notional_lock), `${duration(C.MIN_NOTIONAL_LOCK)} to ${duration(C.MAX_NOTIONAL_LOCK)}`],
    ];
  };

  const spread =
    d.spreadFactor === 0n
      ? 'None. You meet the full spread of each report.'
      : d.spreadFactor === SCALAR
        ? 'All of it. Both sides of the quote sit at the middle.'
        : d.spreadFactor * 2n === SCALAR
          ? 'Each side of the quote moves half the way to the middle of the spread'
          : `Each side of the quote moves ${pct(d.spreadFactor)} of the way to the middle of the spread`;

  const codeRows = [
    ...d.markets.flatMap((m) => [
      [`Market (${m.label})`, `\`${d.releaseHash.market}\``],
      [`Vault (${m.label})`, `\`${d.releaseHash.vault}\``],
    ]),
    ['Oracle', `\`${d.releaseHash.oracle}\``],
    ['Treasury', `\`${d.releaseHash.treasury}\``],
    ['Factory', `\`${d.releaseHash.factory}\``],
    ...d.app.map((c) => [c.name, `\`${c.hash}\``]),
  ];
  const sameCode = hex(d.initMeta.market_hash) === d.releaseHash.market && hex(d.initMeta.vault_hash) === d.releaseHash.vault;
  const sameTreasury = d.initMeta.treasury === d.treasury;

  const sections = [];
  sections.push(`---
title: Deployments
description: Every contract of the live Zenex deployment on Stellar mainnet, and the values those contracts run with.
hide_table_of_contents: true
---

{/* Generated by scripts/deployments/generate.mjs from the chain. Do not edit by hand. Run npm run deployments to refresh it. */}

# Deployments

This page lists every contract of the live Zenex deployment on Stellar mainnet and the values those contracts run with. Check an address here before you approve a transaction that names it. Anyone can deploy a market through the factory, so a contract that carries a familiar name proves nothing on its own. The addresses below are the ones the Zenex app uses.

A script writes this page from the chain. It read every value at ledger ${d.ledger.sequence.toLocaleString('en-US')} on ${date}, and it checked that the contracts report the same addresses about each other. An owner can change a value at any moment, so the contracts hold the value in force.`);

  // One two-column table per market: a full address fits a column, two do not.
  sections.push(`## Markets

${d.markets
  .map((m) =>
    table(
      ['Market', m.label],
      [
        ['Status', STATUS[m.status] ?? `Unknown (${m.status})`],
        ['Market contract', contractLink(m.id)],
        ['Vault', contractLink(m.vault)],
        ['Price stream', `Chainlink Data Streams, \`0x${m.feed}\``],
        ['Vault shares', `${m.vaultName}, shown in a wallet as ${m.vaultSymbol}`],
      ],
    ),
  )
  .join('\n\n')}

Every market settles in ${d.tokenSymbol}${issuerName ? `, the stablecoin ${issuerName} issues on Stellar` : `, issued by the account ${accountLink(d.issuer)}`}. Its contract is ${contractLink(d.tokenId)}.`);

  sections.push(`## Protocol contracts

${table(
  ['Contract', 'Address', 'What it does'],
  [
    ['Factory', contractLink(d.factory), 'Deployed every market and its vault. It answers whether it deployed a given market.'],
    ['Oracle', contractLink(d.oracle), 'Checks every price report before a market uses it.'],
    ['Treasury', contractLink(d.treasury), "Receives the protocol's share of the fees."],
    ['Price report verifier', contractLink(d.verifier), "Chainlink's contract that checks the signatures on each price report. The oracle is fixed to it."],
  ],
)}

Each vault belongs to one market, so the vaults appear with their markets above.`);

  sections.push(`## App contracts

The Zenex app sends your transactions through these contracts. They sit outside the core protocol.

${table(['Contract', 'Address', 'What it does'], [...d.app, ...d.walletVerifiers].map((c) => [c.name, contractLink(c.id), c.does]))}

The fee forwarder pays the fees it takes to the account ${accountLink(d.config.feeForwarder.feeRecipient)}.`);

  sections.push(`## Who controls the contracts

${d.ownerLines.join('\n\n')}

The vaults, ${list(d.app.map((c) => `the ${c.name.toLowerCase()}`))} have no owner. [Governance](./governance.md) covers what an owner can change.`);

  for (const m of d.markets) {
    sections.push(`## ${m.label} parameters

The owner of the market can change any of these values at any moment, but only inside the protocol limit in the last column. The limits are part of the contract code, so no owner can move them. [Market parameters](./markets/market-parameters.md) says what each value does to your money.

${table(['Parameter', 'Value', 'Protocol limit'], parameterRows(m).map(([name, value, limit]) => [name, capital(value), capital(limit)]))}`);
  }

  sections.push(`## Price and treasury settings

The oracle and the treasury serve every market, so their settings sit apart from each market's own set. The oracle owner and the treasury owner change them. [Prices](./markets/prices.md) covers the two age limits and the spread narrowing.

${table(
  ['Setting', 'Value', 'Protocol limit'],
  [
    ['Price age for a fill', duration(d.tradeStaleness), `${duration(O.MIN_STALENESS_SECONDS)} to ${duration(O.MAX_TRADE_STALENESS_SECONDS)}`],
    ['Price age for a liquidation, an auto-deleveraging step, or an accrual', duration(d.closeStaleness), `From the limit for a fill to ${duration(O.MAX_CLOSE_STALENESS_SECONDS)}`],
    ['Spread narrowing', spread, 'From none of the way to all of it'],
    ['Treasury share', `${pct(d.treasuryRate)} of the trade fee, the impact fee, the liquidation fee, the vault fee, and the borrowing charge`, '0% to 50%'],
  ],
)}`);

  sections.push(`## The code at each address

The core contracts run the release build of the Zenex contracts at commit \`${record.core.commit.slice(0, 7)}\`, deployed on ${record.core.deployedOn}. The app contracts run [zenex-util-contracts ${record.util.tag}](${record.util.repo}/releases/tag/${record.util.tag}), deployed on ${record.util.deployedOn}. Each hash below is the hash of the code the chain holds at that address, and the script checked it against the build it names.

${table(['Contract', 'Code hash'], codeRows)}

${
  sameCode && sameTreasury
    ? 'The factory installs the same market and vault code, and wires the same treasury, into every market it deploys from now on.'
    : `The factory now installs market code \`${hex(d.initMeta.market_hash)}\` and vault code \`${hex(d.initMeta.vault_hash)}\`, and wires the treasury ${contractLink(d.initMeta.treasury)}, into each market it deploys from now on. A market deployed earlier keeps what it was deployed with.`
}`);

  return `${sections.join('\n\n')}\n`;
}

const data = await main();
writeFileSync(OUT, render(data));
console.log(`deployments: wrote ${path.relative(ROOT, OUT)} at ledger ${data.ledger.sequence} (${data.markets.length} market${data.markets.length === 1 ? '' : 's'})`);
