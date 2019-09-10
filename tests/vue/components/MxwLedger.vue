<template>
  <div class="cosmosLedger">
    <input
      id="webusb"
      v-model="transportChoice"
      type="radio"
      value="WebUSB"
    >
    <label for="webusb">WebUSB</label>
    <input
      id="u2f"
      v-model="transportChoice"
      type="radio"
      value="U2F"
    >
    <label for="u2f">U2F</label>
    <br>
    <!--
        Commands
    -->
     <button 
     :disabled="connected" 
     @click="connect">
      connect
    </button>
    <button 
    :disabled="!connected" 
    @click="getVersion">
      Get Version
    </button>

    <button 
    :disabled="!connected" 
    @click="showAddress">
      Show Address
    </button>

    <button 
    :disabled="!connected" 
    @click="signExampleTx">
      Sign Example TX
    </button>
    <!--
        Commands
    -->
    <ul id="ledger-status">
      <li
        v-for="item in ledgerStatus"
        :key="item.index"
      >
        {{ item.msg }}
      </li>
    </ul>
  </div>
</template>

<script>
// eslint-disable-next-line import/no-extraneous-dependencies
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
// eslint-disable-next-line import/no-extraneous-dependencies
import TransportU2F from '@ledgerhq/hw-transport-u2f';
import { LedgerSigner } from '../../..';
import { JsonRpcProvider } from 'mxw-sdk-js/dist/providers';


export default {
    name: 'MxwLedger',
    props: {
    },
    data() {
        return {
            deviceLog: [],
            transportChoice: 'WebUSB',
            signer: null,
            connected: false,
            address: "",
            connecting: false,
            provider: new JsonRpcProvider("https://alloys-rpc.maxonrow.com",{ chainId: 'alloys', name: 'alloys' }),
        };
    },
    computed: {
        ledgerStatus() {
            return this.deviceLog;
        },
    },
    methods: {
        log(msg) {
            this.deviceLog.push({
                index: this.deviceLog.length,
                msg,
            });
        },
        async getTransport() {
            let transport = null;

            this.log(`Trying to connect via ${this.transportChoice}...`);
            if (this.transportChoice === 'WebUSB') {
                try {
                    transport = await TransportWebUSB;
                } catch (e) {
                    this.log(e);
                }
            }

            if (this.transportChoice === 'U2F') {
                try {
                    transport = await TransportU2F;
                } catch (e) {
                    this.log(e);
                }
            }
            
            return transport;
        },
     connect(){
            this.connecting =true;
            this.getTransport().then(transport=>{
            LedgerSigner.connect(transport, this.provider).then(signer=>{
               this.signer = signer;
               this.signer.getAddress().then(address=>{
                   if(address){
                        this.address = address;
                        this.connected = true;
                         this.connecting =false;
                   }else {
                       this.log('should throw error');
                   }
               });
           });
            });
        },
        async getVersion() {
          
            this.deviceLog = [];

            // now it is possible to access all commands in the app
            const response = await this.signer.getConfig();

            this.log('Response received!');
            this.log(`App Version ${response.major}.${response.minor}.${response.patch}`);
            this.log(`Device Locked: ${response.device_locked}`);
            this.log(`Test mode: ${response.test_mode}`);
            this.log('Full response:');
            this.log(response);
        },
        async showAddress() {
            this.deviceLog = [];
            const response = await this.signer.getAddress();
            this.log(response);

            this.log('Response received!');
            this.log(`Address ${response}`);
            this.log('Full response:');
            this.log(response);
        },
        async signExampleTx() {
            this.deviceLog = [];

            let transaction ={"type":"cosmos-sdk/StdTx","value":{"msg":[{"type":"mxw/msgSend","value":{"amount":[{"amount":"10000000000000","denom":"cin"}],"from_address":"mxw1edl2ef5c45acvn7062lgz53szyspqx7psxrm4w","to_address":"mxw1hl456zwwc2vl3rq6p4y2amhvpn8znhzt9axn35"}}],"memo":"this is a memo test"},"fee":{"amount":[{"amount":"0","denom":"cin"}],"gas":"0"},"chainId":"alloys","nonce":75,"accountNumber":778}
            this.log('signing');
            const response = await this.signer.sign(transaction);
            this.log('Response received!');
            this.log('Full response:');
            this.log(response);
        },
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
    h3 {
        margin: 40px 0 0;
    }

    button {
        padding: 5px;
        font-weight: bold;
        font-size: medium;
    }

    ul {
        padding: 10px;
        text-align: left;
        alignment: left;
        list-style-type: none;
        background: black;
        font-weight: bold;
        color: greenyellow;
    }
</style>
