import { Keypair, TransactionBuilder, Networks, Horizon, Operation, Asset, BASE_FEE } from '@stellar/stellar-sdk';
const HOME='https://tr-mock-anchor.fly.dev', NET=Networks.TESTNET;
const horizon=new Horizon.Server('https://horizon-testnet.stellar.org');
const j=async(r)=>{const t=await r.text();try{return JSON.parse(t)}catch{return t.slice(0,200)}};

// SEP-1
const toml=await(await fetch(`${HOME}/.well-known/stellar.toml`)).text();
const g=k=>toml.match(new RegExp(`^${k}="(.*)"`,'m'))?.[1];
const AUTH=g('WEB_AUTH_ENDPOINT'), SEP6=g('TRANSFER_SERVER'), KYC=g('KYC_SERVER'), QUOTE=g('ANCHOR_QUOTE_SERVER');
const ISSUER=toml.match(/issuer="(G[A-Z0-9]+)"/)[1];
const USDC=new Asset('USDC',ISSUER);

// hesap + trustline
const kp=Keypair.random();
await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
const acc=await horizon.loadAccount(kp.publicKey());
const tx=new TransactionBuilder(acc,{fee:String(Number(BASE_FEE)*10),networkPassphrase:NET})
  .addOperation(Operation.changeTrust({asset:USDC})).setTimeout(60).build();
tx.sign(kp); await horizon.submitTransaction(tx);
console.log('1) hesap+trustline OK', kp.publicKey());

// SEP-10
const ch=await j(await fetch(`${AUTH}?account=${kp.publicKey()}`));
const ctx=TransactionBuilder.fromXDR(ch.transaction,ch.network_passphrase); ctx.sign(kp);
const {token:JWT}=await j(await fetch(AUTH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction:ctx.toXDR()})}));
const H={Authorization:`Bearer ${JWT}`};
console.log('2) SEP-10 JWT OK');

// SEP-12
const kycPut=await fetch(`${KYC}/customer`,{method:'PUT',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({account:kp.publicKey(),type:'sep6-deposit'})});
console.log('3) SEP-12 PUT', kycPut.status, JSON.stringify(await j(kycPut)).slice(0,200));
const kycGet=await fetch(`${KYC}/customer?account=${kp.publicKey()}`,{headers:H});
console.log('   SEP-12 GET', kycGet.status, JSON.stringify(await j(kycGet)).slice(0,200));

// SEP-38 quote (TRY -> USDC)
const qres=await fetch(`${QUOTE}/quote`,{method:'POST',headers:{...H,'Content-Type':'application/json'},
  body:JSON.stringify({sell_asset:'iso4217:TRY',buy_asset:`stellar:USDC:${ISSUER}`,sell_amount:'500',context:'sep6',sell_delivery_method:'bank_account'})});
const quote=await j(qres);
console.log('4) SEP-38 quote', qres.status, JSON.stringify(quote).slice(0,300));

// SEP-6 deposit-exchange
const p=new URLSearchParams({destination_asset:'USDC',source_asset:'iso4217:TRY',amount:'500',account:kp.publicKey(),type:'bank_account'});
if(quote.id)p.set('quote_id',quote.id);
const dres=await fetch(`${SEP6}/deposit-exchange?${p}`,{headers:H});
const dep=await j(dres);
console.log('5) SEP-6 deposit-exchange', dres.status);
console.log(JSON.stringify(dep,null,2).slice(0,900));

// 6) bankayi oyna: TRY geldi
if (dep.id || dep.more_info_url) {
  const txId = dep.id;
  console.log('\n6) banka transferi simule ediliyor, tx id =', txId);
  const sim = await fetch(`${HOME}/sep6/simulate-bank-transfer`, {
    method:'POST', headers:{...H,'Content-Type':'application/json'},
    body: JSON.stringify({ id: txId })
  });
  console.log('   simulate:', sim.status, JSON.stringify(await j(sim)).slice(0,300));

  // 7) durum takibi
  for (let i=0;i<10;i++){
    const t=await j(await fetch(`${HOME}/sep6/transaction?id=${txId}`,{headers:H}));
    const s=t.transaction?.status;
    console.log(`   [${i}] status=${s} amount_out=${t.transaction?.amount_out ?? '-'} stellar_tx=${(t.transaction?.stellar_transaction_id??'-').slice(0,12)}`);
    if(s==='completed'||s==='error') break;
    await new Promise(r=>setTimeout(r,3000));
  }
  const bal=await horizon.loadAccount(kp.publicKey());
  const line=bal.balances.find(b=>b.asset_code==='USDC');
  console.log('\n8) CUZDAN USDC BAKIYESI:', line?.balance ?? '0');
}
