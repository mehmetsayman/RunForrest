import { rpc, xdr, Asset, Networks, Address } from '@stellar/stellar-sdk';
const server = new rpc.Server('https://soroban-testnet.stellar.org');

const IDS = {
  factory:        'CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32',
  usdc_vault:     'CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN',
  usdc_blend_str: 'CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY',
};
const ANCHOR_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const anchorSac = new Asset('USDC', ANCHOR_ISSUER).contractId(Networks.TESTNET);
console.log('Anchor USDC SAC :', anchorSac, '\n');

const wasmHashes = {};
for (const [name, cid] of Object.entries(IDS)) {
  try {
    const e = await server.getContractData(cid, xdr.ScVal.scvLedgerKeyContractInstance(), rpc.Durability.Persistent);
    const inst = e.val.value().val().instance();
    let wasm = null;
    try { wasm = Buffer.from(inst.executable().wasmHash()).toString('hex'); } catch {}
    const storage = inst.storage() || [];
    const refs = new Set();
    for (const it of storage) {
      const scan = (v) => {
        try {
          const t = v.switch().name;
          if (t === 'scvAddress') refs.add(Address.fromScAddress(v.address()).toString());
          else if (t === 'scvVec') (v.vec()||[]).forEach(scan);
          else if (t === 'scvMap') (v.map()||[]).forEach(m => { scan(m.key()); scan(m.val()); });
        } catch {}
      };
      scan(it.key()); scan(it.val());
    }
    wasmHashes[name] = wasm;
    console.log(`${name.padEnd(15)} CANLI   ttl->${e.liveUntilLedgerSeq}  storage=${storage.length}`);
    const r = [...refs];
    if (r.length) console.log(`${''.padEnd(15)} referanslar: ${r.join('\n' + ''.padEnd(29))}`);
    if (r.includes(anchorSac)) console.log(`${''.padEnd(15)} >>> ANCHOR USDC ILE AYNI SAC <<<`);
  } catch (err) {
    console.log(`${name.padEnd(15)} YOK -> ${String(err.message).slice(0, 90)}`);
  }
  console.log('');
}

// vault wasm'inin disa acik fonksiyonlari
if (wasmHashes.usdc_vault) {
  const w = await server.getLedgerEntries(
    xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({ hash: Buffer.from(wasmHashes.usdc_vault, 'hex') }))
  );
  if (w.entries?.length) {
    const code = w.entries[0].val.value().code();
    console.log('vault WASM:', code.length, 'bayt');
    const s = code.toString('latin1');
    const names = [...new Set(s.match(/[a-z][a-z_0-9]{2,30}/g) || [])];
    const likely = names.filter(n => /^(deposit|withdraw|balance|total_|get_|set_|initialize|shares|fee|invest|unwind|emergency|report|strateg|rescue|asset|upgrade|rebalance)/.test(n));
    console.log('fonksiyon adaylari:\n ', likely.slice(0, 50).join(', '));
  }
}
