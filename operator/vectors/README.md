# Test vectors

Emitted by `test_emit_typescriptVector` in
`contracts-v2/contracts/test/unit/hca/AutoRenewPolicy.t.sol`. That test runs the
same `_prepareBatch` as T1 and asserts the account accepts the payload before
printing it, so a match in `operator/session.vector.test.ts` means the
TypeScript produced a payload the deployed policy accepted — not merely that
two encoders agree.

Regenerate with `scripts/dump-vector.sh` after any change to the fixture, the
test helpers, or the validator's packing.

## The private keys in these files are Foundry test keys

`renew-t1.json` carries `ownerPrivateKey` and `sessionPrivateKey`. Both come
from Foundry's deterministic `makeAddrAndKey`, derived from a label string.
They are not project keys:

- Neither matches `DEPLOYER_PRIVATE_KEY` or `SESSION_PRIVATE_KEY` in the root
  `.env`. Checked, not assumed.
- Neither matches the compromised key named in `AGENTS.md` hard rule 2.
- Neither is the `estmcmxci.eth` owner key named in hard rule 3.

They hold nothing on any network and exist only so the vector is reproducible.

Keep it that way. A vector in this directory must never carry a key that
controls anything. If a future vector needs a funded account, store its address
and leave the key in `.env`.
