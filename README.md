mwx-ledger-signer
=============

Implement MXW Signer for ledger nano s or x 

Importing
---------

**Node.js**

This will connect to the Ledger via the HID protocol.

```javascript
const { LedgerSigner } = require('mxw-ledger-signer');
```

**Browser**

This will connect to the Ledger via the U2F protocol, which requires a compatible
browser (e.g. Chrome, Opera) and the site **must** be hosted on an SSL site. The
Ledger **must** also be in "Broswer Mode".

```javascript
<!-- MUST load the mxw-sdk-js library first -->
<script src="" type="text/javascript">
<script src="" type="text/javascript">
<script type="text/javascript">
    const LedgerSigner = mxw.LedgerSigner;
</script>
```

**TypeScript**

```javascript
import { LedgerSigner } from "mxw-ledger-signer";
```

API
---

```javascript

// Options are optional; this is the default
let options = {
    path: "m'/44'/376'/0'/0/0"
};

let provider = new mxw.providers.JsonRpcProvider("https://alloys-rpc.maxonrow.com", "alloys");

// Connect using the Transport
// - In the browser, the U2F interface or WEBUSB interface
// - In node.js, the HID interface
let Transport =  require("@ledgerhq/hw-transport-node-hid").default;
let signer = LedgerSigner.connect(Transport, provider, options);

signer.getAddress().then((address) => {
    console.log(address);
});

let transaction ={"type":"cosmos-sdk/StdTx","value":{"msg":[{"type":"mxw/msgSend","value":{"amount":[{"amount":"10000000000000","denom":"cin"}],"from_address":"mxw1edl2ef5c45acvn7062lgz53szyspqx7psxrm4w","to_address":"mxw1hl456zwwc2vl3rq6p4y2amhvpn8znhzt9axn35"}}],"memo":"this is a memo test"},"fee":{"amount":[{"amount":"0","denom":"cin"}],"gas":"0"},"chainId":"alloys","nonce":75,"accountNumber":778}

  
signer.sign(transaction).then((tx) => {
    console.log('Transaction', tx);
});

// This requires a provider was provided
signer.sendTransaction(tx).then((tx) => {
    console.log(tx);
    // "0x..."
});


```

Custom Transport
----------------

If you need to specify the transport to use, the constructor can be called
directly:

```
let signer = new LedgerSigner(transport, provider, options);

```

Credits
-------
- [ethers-ledger](https://github.com/ethers-io/ethers-ledger/) for the reference signer implementation

License
-------

MIT License.