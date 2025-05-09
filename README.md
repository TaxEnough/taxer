# Volume bot on EVM chains

## Supported chains
BSC

## Technology

Languange: Typescript
Type: Bot

## How to use?

- You should install node modules by
```
npm i
```

- Edit some content in the `.env` file. I already sent you the project with `.env` file.

You should input your wallet address and privatekey there.
```
BSC_WALLET_ADDRESS="Your wallet address"
BSC_WALLET_ADDRESS="The private key of your main wallet"
```
There are rpc addresses in thge`.env` file and they are not paid version.

If you have good one you can replce them with yours.

- Then you should see the `config.json` file. I has the main configurations for running the bot. I added comments for your good understanding.
```
//Random amount for wallet.
export const amountMax = 0.003; //Bnb balance
export const amountMin = 0.001; //

//Fee balance that must be remaining in the wallet
export const fee = 0.001; //Must be greater than 0.001
```
Before that you should have enough BNB in your base wallet.

For example if you set config values like this...
```
//Random time interval of buy and sell
export const maxInterval = 30000 //millisecond
export const minInterval = 5000//millisecond

//Number of sub wallets.
export const subWalletNum = 20;

//ChainId : BSC, Ethereum
export const CHAINID:ChainId = ChainId.BSC;
```
Then you can run the bot
```
npm run dev
```

## Features
- Generating random wallets
- Funding wallets that will trade as real traders
- Random trade with funded wallets
- Gathering funds after work



## Tx links
https://bscscan.com/tx/0x581cda788080b52fbd5db8c4d3500c22a6c136a07b73e2311d1fc29330d48fe5
https://bscscan.com/tx/0x8c870cf1721c2c765b45d2b13731bf384ec2e8020552aafb0436c01ded98f2ab
https://bscscan.com/tx/0xb46d289c48d04dc6cc74849ecd9ef4fff6bf86aa3b16fc231d019b82c7789bc2

## Future
- Randomizing trading amount
- Randomizing trading frequency (Buy/Sell)
- Randomizing the pool

## How to contact
Telegram: [@solidmarketing](https://t.me/solidmarketing)


