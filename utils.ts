import axios from "axios";
import fs from "fs";
import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { getPdaMetadataKey } from '@raydium-io/raydium-sdk';
import { getMetadataAccountDataSerializer } from '@metaplex-foundation/mpl-token-metadata';
import { symbols } from "pino";
import { getMint, TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
const tokenMint = "9t31CoUG4Xb77AW5exQhQtGy3Kz2MPrNifno6tbJzRTn"
const solanaConnection = new Connection('https://aged-maximum-pallet.solana-mainnet.quiknode.pro/5d2476aba2f79657eee64c4c71173eb549693756/');

export const getTokenInfo = async () => {
    try {
        const metadataPDA = getPdaMetadataKey(new PublicKey(tokenMint));
        const metadataAccount = await solanaConnection.getAccountInfo(metadataPDA.publicKey);
        const mintInfo = await getMint(solanaConnection, new PublicKey(tokenMint));
        const ownerInfo = await getTokenInfo();
        // const allAccounts = await findHolders();
        // console.log("all Owners ==>> ", allAccounts);

        const pairs = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
        console.log(pairs.data.pairs[0]);
        fs.writeFile('myFile.json', JSON.stringify(pairs.data.pairs), function (err) {
            console.log(err);
        });
        const pairdata = pairs.data.pairs[0];

        if (!metadataAccount) {
            return { ok: false, message: 'Mutable -> Failed to fetch account data' };
        }

        const serializer = getMetadataAccountDataSerializer()
        const deserialize = serializer.deserialize(metadataAccount.data);

        const result = {
            name: deserialize[0].name,
            symbols: deserialize[0].symbol,
            supply: mintInfo.supply,
            decimal: mintInfo.decimals,
            websites: pairdata.info.websites,
            socials: pairdata.info.socials,
            exchange: pairdata.dexId,
            liquidity: pairdata.liquidity.usd,
            tokenPrice: pairdata.priceUsd,
            pooledSol: pairdata.liquidity.quote,
            ownerInfo
        }
        console.log("account info", result);

    } catch (e: any) {
        console.log(e);

    }
}

//   const findHolders = async () => {
//     const allAccounts = await solanaConnection.getProgramAccounts(TOKEN_PROGRAM_ID, {
//         commitment: 'confirmed',
//         filters: [
//             {
//                 memcmp: {
//                     offset: 0,
//                     bytes: tokenMint,
//                 },
//             },
//         ],
//     })
//     return allAccounts
//   };


export const getMultiplePairs = () => {
    (async () => {
        try {
            const pairs = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);

            const data = await solanaConnection.getSignaturesForAddress(new PublicKey(pairs.data.pairs[0].pairAddress));
            // const data = await solanaConnection.getSignaturesForAddress(new PublicKey(tokenMint));
            const filter_by_time = data.filter((elem: any) => elem.blockTime * 1000 < pairs.data.pairs[0].pairCreatedAt + 15000);
            
            const sniper: string[] = [];
            console.log("Searching bots......");
            let index = 0;
            for (const iterator of filter_by_time) {
                console.log(index++);
                
                const history = await solanaConnection.getParsedTransaction(iterator.signature, {
                    maxSupportedTransactionVersion: 0,
                });

                sniper.push(history?.transaction?.message?.accountKeys?.[0]?.pubkey?.toString() ?? '');
            }
            
            console.log("Done");

            let uniqueArray = [...new Set(sniper)];
            console.log(uniqueArray);
            
        } catch (error) {
            console.log("Dexscreener error ====>", error);
        }
    }
    )();
}

export const ownersInfo = async () => {
    const filters = [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: tokenMint } }
    ];

    const holders = await solanaConnection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        encoding: "base64",
        filters
    });
    // console.log(holders.length);

    const owner_info: number[] = [];
    let index = 1;
    console.log(holders.length);
    holders.map(async (value, i) => {
        console.log(i);

        setTimeout(async () => {
            const info = await getAccount(solanaConnection, value.pubkey);
            const amount = Number(info.amount);
            const mint = await getMint(solanaConnection, info.mint);
            const balance = amount / (10 ** mint.decimals);
            console.log(index++, '->', balance);
            if (balance) {
                owner_info.push(
                    balance
                )
            }
        }, 60 * i);
        if (i == holders.length)
            process.exit(1)
    })
    return owner_info.sort();
    // console.log(owner_info.length, owner_info.sort());
}

////////////////// Helius API test ////////////////////////////////
export const getHelius = async() => {
    const pairs = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
    let url = `https://api.helius.xyz/v0/addresses/${pairs.data.pairs[0].pairAddress}/transactions?api-key=3687620b-0a4f-479f-8c80-db19cc52966d`;
    let lastSignature = null;

    (async () => {
        let index = 0;
        while (true) {
            if (lastSignature) {
                url += `&before=${lastSignature}`;
            }
            const response = await fetch(url);
            const transactions = await response.json();

            if (transactions && transactions.length > 0) {
                console.log("Fetched transactions: ", transactions);
                lastSignature = transactions[transactions.length - 1].signature;
            } else {
                console.log("No more transactions available.");
                break;
            }
        }
    })();
}